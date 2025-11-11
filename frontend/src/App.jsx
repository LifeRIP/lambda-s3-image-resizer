import { useEffect, useRef, useState } from "react";
import "./App.css";
import "./upload.css";

// Helper function to format bytes
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

// Simple UI to interact with presign and list Lambda endpoints.
function App() {
  const STORAGE_KEY = "apiGatewayBase";
  const [apiBase, setApiBase] = useState(
    () => localStorage.getItem(STORAGE_KEY) || ""
  );
  const [configInput, setConfigInput] = useState(apiBase);

  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef();
  const [uploading, setUploading] = useState(false);

  const [files, setFiles] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    // if an API base is present, try to load files on mount
    if (apiBase) {
      fetchList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyConfig() {
    setApiBase(configInput.trim());
    localStorage.setItem(STORAGE_KEY, configInput.trim());
    setMessage("Applied API URL");
  }

  function clearConfig() {
    setConfigInput("");
    setApiBase("");
    localStorage.removeItem(STORAGE_KEY);
    setFiles([]);
    setMessage("Cleared API URL");
  }

  function onBrowseClick() {
    fileInputRef.current?.click();
  }

  function onFileChange(e) {
    const f = e.target.files?.[0] || null;
    setSelectedFile(f);
  }

  async function onUpload() {
    setMessage(null);
    if (!apiBase) return setMessage("Please apply an API Gateway URL first");
    if (!selectedFile) return setMessage("Select a file to upload");

    setUploading(true);
    try {
      // Ask Lambda to generate a presigned POST form data
      const presignUrl = `${apiBase}/presign/${encodeURIComponent(
        selectedFile.name
      )}`;
      console.log("Requesting presign from", presignUrl);

      const resp = await fetch(presignUrl, {
        method: "GET",
      }).catch((networkErr) => {
        throw new Error(`Network error: ${networkErr.message}`);
      });

      // TODO: handle the error correctly, this if block never reaches
      if (!resp.ok) {
        console.error("Presign failed:", resp.status, resp.statusText);
        const errorText = await resp.text().catch(() => "");
        throw new Error(
          `Presign failed (${resp.status})${errorText ? `: ${errorText}` : ""}`
        );
      }

      const data = await resp.json().catch(() => {
        throw new Error("Invalid JSON response from presign endpoint");
      });

      // Check if we have the presigned POST data (url + fields)
      if (!data.url || !data.fields) {
        console.error("Invalid presign response:", data);
        throw new Error("Presign response missing url or fields");
      }

      // Create FormData for S3 POST upload
      const formData = new FormData();

      // Add all the fields from the presigned response
      Object.keys(data.fields).forEach((key) => {
        formData.append(key, data.fields[key]);
      });

      // Add the file last
      formData.append("file", selectedFile);

      // POST to S3 with the presigned form data
      const uploadResp = await fetch(data.url, {
        method: "POST",
        body: formData,
      }).catch((networkErr) => {
        throw new Error(`Upload network error: ${networkErr.message}`);
      });

      if (!(uploadResp.ok || uploadResp.status === 204)) {
        console.error(
          "Upload failed:",
          uploadResp.status,
          uploadResp.statusText
        );
        const errorText = await uploadResp.text().catch(() => "");
        throw new Error(
          `Upload failed (${uploadResp.status})${
            errorText ? `: ${errorText}` : ""
          }`
        );
      }

      setMessage("Upload successful");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      alert("Upload successful!");
      // refresh list after upload
      await fetchList();
    } catch (err) {
      console.error("Upload error:", err);
      setMessage(String(err.message || err));
    } finally {
      setUploading(false);
    }
  }

  async function fetchList() {
    if (!apiBase) return setMessage("Please apply an API Gateway URL first");
    setLoadingList(true);
    setMessage(null);
    try {
      console.log("Fetching file list from", apiBase);
      const listUrl = `${apiBase}/list`;

      const resp = await fetch(listUrl).catch((networkErr) => {
        throw new Error(`Network error: ${networkErr.message}`);
      });

      if (!resp.ok) {
        console.error("List failed:", resp.status, resp.statusText);
        const errorText = await resp.text().catch(() => "");
        throw new Error(
          `List failed (${resp.status})${errorText ? `: ${errorText}` : ""}`
        );
      }

      const data = await resp.json().catch(() => {
        throw new Error("Invalid JSON response from list endpoint");
      });

      // Parse the new API format
      // Expected format: [{ Name, Timestamp, Original: { Size, URL }, Resized?: { Size, URL } }]
      const normalized = Array.isArray(data)
        ? data.map((item) => {
            if (!item) return null;

            // Handle new format with Original and Resized
            if (item.Original || item.Resized) {
              return {
                name: item.Name || "Unknown",
                timestamp: item.Timestamp,
                originalUrl: item.Original?.URL,
                originalSize: item.Original?.Size,
                resizedUrl: item.Resized?.URL,
                resizedSize: item.Resized?.Size,
                // Use resized if available, otherwise original
                url: item.Resized?.URL || item.Original?.URL,
                size: item.Resized?.Size || item.Original?.Size,
              };
            }
            return null;
          })
        : [];

      setFiles(normalized.filter(Boolean));
    } catch (err) {
      console.error("List error:", err);
      setMessage(String(err.message || err));
    } finally {
      setLoadingList(false);
    }
  }

  return (
    <div className="upload-app">
      <h2>Image Upload → Lambda (presign + list)</h2>

      <section className="card config">
        <h3>Configuration</h3>
        <div className="row">
          <input
            type="text"
            placeholder="https://{...}.execute-api.{region}.amazonaws.com/prod"
            value={configInput}
            onChange={(e) => setConfigInput(e.target.value)}
            className="input-url"
          />
          <div className="btns">
            <button onClick={applyConfig} className="btn primary">
              Apply
            </button>
            <button onClick={clearConfig} className="btn">
              Clear
            </button>
          </div>
        </div>
        <p className="muted">
          API routes expected: <code>/presign</code> and <code>/list</code>
        </p>
      </section>

      <section className="card upload">
        <h3>Upload Your File</h3>
        <div className="row">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onFileChange}
            style={{ display: "none" }}
          />
          <button onClick={onBrowseClick} className="btn">
            Browse
          </button>
          <div className="file-info">
            {selectedFile ? selectedFile.name : "No file selected"}
          </div>
          <button
            onClick={onUpload}
            className="btn primary"
            disabled={!selectedFile || uploading}
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>
        <p className="muted">
          Upload will request a presigned URL from the Lambda{" "}
          <code>/presign</code> route and PUT the file there.
        </p>
      </section>

      <section className="card list">
        <h3>List Your Files</h3>
        <div className="row">
          <button onClick={fetchList} className="btn" disabled={loadingList}>
            {loadingList ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="files-grid">
          {files.length === 0 && <div className="muted">No files found</div>}
          {files.map((f, idx) => (
            <div key={idx} className="file-card">
              {f.url ? (
                <>
                  <img src={f.url} alt={f.name || `file-${idx}`} />
                  <div className="file-details">
                    {f.name && <div className="file-name">{f.name}</div>}
                    {f.size && (
                      <div className="file-size">
                        {formatBytes(f.size)}
                        {f.resizedUrl && f.originalSize && " (resized)"}
                      </div>
                    )}
                    {f.timestamp && (
                      <div className="file-timestamp">
                        {new Date(f.timestamp).toLocaleString()}
                      </div>
                    )}
                    {f.resizedUrl && f.originalUrl && (
                      <div className="file-versions">
                        <a
                          href={f.originalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="version-link"
                        >
                          Original ({formatBytes(f.originalSize)})
                        </a>
                        <span> | </span>
                        <a
                          href={f.resizedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="version-link"
                        >
                          Resized ({formatBytes(f.resizedSize)})
                        </a>
                      </div>
                    )}
                  </div>
                </>
              ) : f.key ? (
                <div className="file-key">{f.key}</div>
              ) : (
                <div className="file-key">Unknown item</div>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="status">
        {message && <div className="message">{message}</div>}
        <div className="small-muted">
          API base: {apiBase || <em>not configured</em>}
        </div>
      </div>
    </div>
  );
}

export default App;
