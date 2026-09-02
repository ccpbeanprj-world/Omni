import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./style.css";

// Fix btoa encoding issues with Unicode characters globally
if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
  const originalBtoa = window.btoa;
  window.btoa = function(str: string) {
    try {
      return originalBtoa(str);
    } catch (error) {
      // If btoa fails due to Unicode characters, encode to UTF-8 first
      return originalBtoa(unescape(encodeURIComponent(str)));
    }
  };
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);