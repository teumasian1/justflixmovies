// Create and initialize the debugLog function
const DEBUG_MODE = true; // Set to false in production
const loggerElement = document.createElement('div');
loggerElement.style.display = 'none';
document.body.appendChild(loggerElement);

// Create the logger function
function debugLog(message, category = 'general') {
    if (DEBUG_MODE) {
        console.log(`[${category}]`, message);
    }
    
    // Always log image loading related messages to support poster loading
    if (category === 'image') {
        loggerElement.setAttribute('data-last-image', message);
    }
}

// Export the function and add it to window
export { debugLog };

// Also expose it globally for non-module scripts
window.debugLog = debugLog;
