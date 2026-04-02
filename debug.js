// Syft Debug UI Module
// This file contains the persistent anchored visual overlay UI for debugging Syft.

(function SyftDebugModule() {
    'use strict';

    if (window.SyftDebug) return;

    window.SyftDebug = {
        push: function(tag, dump) {
            const overlayId = 'syft-debug-overlay';
            let overlay = document.getElementById(overlayId);
            
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = overlayId;
                overlay.style.cssText = 'position:fixed;bottom:100px;left:24px;background:#FF4500;color:#fff;z-index:9999999;font-family:monospace;max-width:500px;font-size:13px;border:3px solid #FFA500;border-radius:10px;box-shadow: none;display:flex;flex-direction:column;';
                
                const header = document.createElement('div');
                header.style.cssText = 'background:#CC3700;padding:8px 12px;cursor:pointer;border-top-left-radius:7px;border-top-right-radius:7px;display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #FFA500;font-weight:900;text-shadow:none;';
                header.innerHTML = '<span>Syft Debug Log</span><span id="syft-debug-toggle">▼</span>';
                
                const content = document.createElement('div');
                content.id = 'syft-debug-content';
                content.style.cssText = 'padding:10px;max-height:400px;overflow-y:auto;white-space:pre-wrap;display:block;background:rgba(0,0,0,0.85);border-bottom-left-radius:7px;border-bottom-right-radius:7px;';
                
                header.onclick = () => {
                    const toggle = document.getElementById('syft-debug-toggle');
                    if (content.style.display === 'none') {
                        content.style.display = 'block';
                        toggle.textContent = '▼';
                    } else {
                        content.style.display = 'none';
                        toggle.textContent = '▲';
                    }
                };
                
                overlay.appendChild(header);
                overlay.appendChild(content);
                document.body.appendChild(overlay);
            }
            
            const content = document.getElementById('syft-debug-content');
            if (content) {
                content.innerHTML += `<div><strong style="color:#FFA500">${tag}</strong>: ${dump}</div><div style="height:1px;background:#555;margin:5px 0;"></div>`;
                content.scrollTop = content.scrollHeight;
            }
        }
    };

    // Auto-init visible debug log
    window.SyftDebug.push('System', 'Debug Console Initialized');
})();
