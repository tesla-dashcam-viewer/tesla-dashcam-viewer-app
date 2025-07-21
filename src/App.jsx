import React, { useState, useEffect, useRef } from "react";

const CAMERA_KEYS = [
  ["left_pillar", "front", "right_pillar"],
  ["right_repeater", "back", "left_repeater"]
];

export default function App() {
  const [batches, setBatches] = useState({});
  const [batchKeys, setBatchKeys] = useState([]);
  const [activeBatchKey, setActiveBatchKey] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(60);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [videoURLs, setVideoURLs] = useState({});
  const [carouselThumbnails, setCarouselThumbnails] = useState({});

  const videoRefs = useRef({});

  const handleDirectoryUpload = (e) => {
    const files = Array.from(e.target.files);
    const videosByBatch = {};
    const thumbs = {};

    files.forEach(file => {
      if (file.name === "event.json") {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            setMetadata(JSON.parse(e.target.result));
          } catch {
            console.warn("Invalid event.json");
          }
        };
        reader.readAsText(file);
      }

      const match = file.name.match(/(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})-(front|back|left_pillar|right_pillar|left_repeater|right_repeater)\.mp4$/);
      if (match) {
        const [_, timestamp, angle] = match;
        if (!videosByBatch[timestamp]) videosByBatch[timestamp] = {};
        videosByBatch[timestamp][angle] = file;

        if (angle === "front" && !thumbs[timestamp]) {
          thumbs[timestamp] = URL.createObjectURL(file);
        }
      }
    });

    const sortedKeys = Object.keys(videosByBatch).sort();
    setBatches(videosByBatch);
    setBatchKeys(sortedKeys);
    setCarouselThumbnails(thumbs);
    setMetadata(null);
    setCurrentTime(0);
    setIsPlaying(false);

    if (sortedKeys.length > 0) {
      loadBatch(sortedKeys[0], videosByBatch[sortedKeys[0]], true);
    }
  };

  const loadBatch = (batchKey, filesObj, autoPlay = false) => {
    const loaded = {};
    Object.entries(filesObj).forEach(([angle, file]) => {
      loaded[angle] = URL.createObjectURL(file);
    });
    setVideoURLs(loaded);
    setActiveBatchKey(batchKey);
    setCurrentTime(0);

    setTimeout(() => {
      Object.values(videoRefs.current).forEach(v => {
        if (v) {
          v.currentTime = 0;
          v.playbackRate = playbackRate;
          if (autoPlay) v.play();
        }
      });
      setIsPlaying(autoPlay);
    }, 300);
  };

  const handlePlayPause = () => {
    const anyPlaying = Object.values(videoRefs.current).some(v => v && !v.paused);
    setIsPlaying(!anyPlaying);
    Object.values(videoRefs.current).forEach(video => {
      if (video) {
        video.playbackRate = playbackRate;
        anyPlaying ? video.pause() : video.play();
      }
    });
  };

  const handleSpeedChange = (rate) => {
    setPlaybackRate(rate);
    Object.values(videoRefs.current).forEach(v => {
      if (v) v.playbackRate = rate;
    });
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    Object.values(videoRefs.current).forEach(v => {
      if (v) v.currentTime = time;
    });
  };

  const handleNextBatch = () => {
    const idx = batchKeys.indexOf(activeBatchKey);
    if (idx < batchKeys.length - 1) {
      loadBatch(batchKeys[idx + 1], batches[batchKeys[idx + 1]], true);
    }
  };

  const handlePrevBatch = () => {
    const idx = batchKeys.indexOf(activeBatchKey);
    if (idx > 0) {
      loadBatch(batchKeys[idx - 1], batches[batchKeys[idx - 1]], true);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const front = videoRefs.current["front"];
      if (front && !front.paused) {
        setCurrentTime(front.currentTime);
        if (front.currentTime >= front.duration - 0.3) {
          handleNextBatch();
        }
      }
    }, 200);
    return () => clearInterval(interval);
  }, [activeBatchKey, batchKeys]);

  return (
    <div className="min-h-screen bg-black text-white p-4 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-6">Tesla Dashcam Viewer</h1>

      <div className="w-full flex flex-wrap gap-4 items-center justify-between max-w-screen-xl mb-4">
        <label className="text-sm">
          <span className="mr-2">Select Folder:</span>
          <input type="file" webkitdirectory="true" multiple onChange={handleDirectoryUpload} />
        </label>
        <div className="flex gap-2">
          {[0.5, 1, 2, 5].map(rate => (
            <button
              key={rate}
              onClick={() => handleSpeedChange(rate)}
              className={`px-3 py-1 rounded ${playbackRate === rate ? "bg-blue-600" : "bg-gray-600"}`}
            >
              {rate}x
            </button>
          ))}
        </div>
        {metadata && (
          <div className="text-xs text-right">
            <p><strong>Time:</strong> {new Date(metadata.timestamp).toLocaleString()}</p>
            <p><strong>Location:</strong> {metadata.city} ({metadata.est_lat}, {metadata.est_lon})</p>
            <p><strong>Reason:</strong> {metadata.reason}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6 max-w-screen-xl w-full">
        {CAMERA_KEYS.flat().map((cam) => (
          <div key={cam} className="bg-gray-800 rounded p-2">
            <video
              ref={(el) => (videoRefs.current[cam] = el)}
              controls
              src={videoURLs[cam] || ""}
              onLoadedMetadata={(e) => cam === "front" && setDuration(e.target.duration)}
              className="w-full h-48 object-contain"
            />
            <div className="text-xs mt-1 text-gray-300">
              <strong>Camera:</strong> {cam.replace("_", " ")}
            </div>
          </div>
        ))}
      </div>

      <input
        type="range"
        min="0"
        max={duration}
        step="0.1"
        value={currentTime}
        onChange={handleSeek}
        className="w-full max-w-screen-xl mb-4 appearance-none h-2 bg-gray-600 rounded outline-none slider-thumb"
        style={{ WebkitAppearance: "none" }}
      />

      <div className="flex items-center gap-6 mb-4">
        <button onClick={handlePrevBatch} className="text-2xl">⏮</button>
        <button
          onClick={handlePlayPause}
          className={`px-4 py-1 rounded ${isPlaying ? "bg-blue-600" : "bg-gray-600"}`}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>
        <button onClick={handleNextBatch} className="text-2xl">⏭</button>
      </div>

      <div className="flex overflow-x-auto gap-4 w-full max-w-screen-xl pb-2">
        {batchKeys.map((key) => (
          <div
            key={key}
            onClick={() => loadBatch(key, batches[key], true)}
            className={`cursor-pointer border-2 rounded w-40 shrink-0 ${key === activeBatchKey ? "border-red-500" : "border-transparent"}`}
          >
            <video src={carouselThumbnails[key]} className="w-full h-24 object-cover" muted preload="metadata" />
            <div className="text-xs text-center py-1">{key.replace("_", " ").replace(/(\d{4}-\d{2}-\d{2}) (\d{2})-(\d{2})-(\d{2})/, "$1 $2:$3:$4")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}