// Constants
export const API_KEY = 'f7969edc09425407417da271f5077c89';
export const BASE_URL = 'https://api.themoviedb.org/3';
export const IMG_URL = 'https://image.tmdb.org/t/p/w500';
export const BACKDROP_URL = 'https://image.tmdb.org/t/p/original';  // For banner images
export const POSTER_URL = 'https://image.tmdb.org/t/p/w500';       // For poster images
export const STILL_URL = 'https://image.tmdb.org/t/p/w300';        // For episode stills

// Anti-interference measures
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Retry wrapper function
async function withRetry(fn, retries = MAX_RETRIES) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            console.warn(`Retry attempt ${i + 1} for operation`);
        }
    }
}

// Error handler for script interference
function handleScriptError(error) {
    console.warn('Script error caught:', error);
    if (error.name === 'ReferenceError') {
        return true; // Indicates error was handled
    }
    return false; // Let other errors propagate
}

window.addEventListener('error', (event) => {
    if (handleScriptError(event.error)) {
        event.preventDefault();
    }
});

// Video server endpoints
const MOVIE_ENDPOINTS = [
  'https://vidlink.pro/movie/',
  'https://111movies.com/movie/',
  'https://vidjoy.pro/embed/movie/',
  'https://vidsrc.io/embed/movie/',
  'https://vidsrc.cc/v2/embed/movie/',
  'https://vidsrc.xyz/embed/movie/',
  'https://www.2embed.cc/embed/',
  'https://moviesapi.club/movie/',
  'https://multiembed.mov/embed/movie/',
  'https://embedmovie.net/movie/',
  'https://database.gdriveplayer.us/player.php?imdb=',
  'https://player.videasy.net/movie/'
];

const TV_ENDPOINTS = [
  'https://vidlink.pro/tv/',
  'https://111movies.com/tv/',
  'https://vidjoy.pro/embed/tv/',
  'https://vidsrc.io/embed/tv/',
  'https://vidsrc.cc/v2/embed/tv/',
  'https://vidsrc.xyz/embed/tv/',
  'https://www.2embed.cc/embedtv/',
  'https://moviesapi.club/tv/',
  'https://multiembed.mov/embed/tv/',
  'https://embedmovie.net/tv/',
  'https://player.videasy.net/tv/'
];

let currentItem;

// Main function to show video modal
async function showDetails(item) {
  try {
    currentItem = item;
    logDebug(`Showing details for: ${item.title || item.name}`);
    
    const modal = document.getElementById('modal');
    if (!modal) {
      logDebug('Error: Modal container not found');
      return;
    }
      // Hide main content and show modal
    document.getElementById('main-content').style.display = 'none';
    document.getElementById('search-results').style.display = 'none';
    document.getElementById('browse-content').style.display = 'none';
    
    modal.style.display = 'flex';
    modal.classList.add('show');
    
    // Set modal content
    document.getElementById('modal-title').textContent = item.title || item.name;
    document.getElementById('modal-description').textContent = item.overview;
    document.getElementById('modal-image').src = `${IMG_URL}${item.poster_path}`;
    document.getElementById('modal-rating').innerHTML = '★'.repeat(Math.round(item.vote_average / 2));
    document.getElementById('modal-year').textContent = new Date(item.release_date || item.first_air_date).getFullYear();
      // Set media type
    currentItem.media_type = currentItem.media_type || (currentItem.first_air_date ? 'tv' : 'movie');
    logDebug(`Media type set to: ${currentItem.media_type}`);

    // Show/hide season and episode section based on media type
    const episodesSection = document.querySelector('.episodes-section');
    if (episodesSection) {
      episodesSection.style.display = currentItem.media_type === 'tv' ? 'flex' : 'none';
    }

    // Show/hide season and episode dropdowns based on media type
    const modalDropdowns = document.querySelector('.modal-dropdowns');
    if (modalDropdowns) {
      modalDropdowns.style.display = currentItem.media_type === 'tv' ? 'flex' : 'none';
    }
    
    // Populate server buttons
    logDebug('Populating server buttons...');
    populateServerButtons();
    
    // Try all servers in order and select the first working one
    const type = currentItem.media_type;
    const endpoints = type === 'movie' ? MOVIE_ENDPOINTS : TV_ENDPOINTS;
    const servers = [
      { id: 'vidsrc.cc' },
      { id: 'vidsrc.me' },
      { id: 'player.videasy.net' },
      ...endpoints.map((_, i) => ({ id: `server${i + 3}` }))
    ];

    let found = false;
    for (let i = 0; i < servers.length; i++) {
      const serverId = servers[i].id;
      const url = getServerUrl(serverId, type, currentItem.id);
      if (!url) continue;

      try {
        logDebug(`Testing server ${serverId} with URL: ${url}`);
        const response = await fetch(url, { method: 'HEAD', mode: 'no-cors' });
        if (response.ok || response.type === 'opaque') {
          logDebug(`Server ${serverId} is working`);
          changeServer(serverId);
          const buttons = document.querySelectorAll('.server-btn');
          buttons.forEach(btn => btn.classList.remove('active'));
          const activeButton = Array.from(buttons).find(btn => btn.dataset.server === serverId);
          if (activeButton) activeButton.classList.add('active');
          found = true;
          break;
        }
      } catch (e) {
        logDebug(`Error testing server ${serverId}: ${e.message}`);
      }
    }

    // If none work, fallback to first
    if (!found) {
      logDebug('No working servers found, falling back to default');
      changeServer('vidsrc.cc');
      const buttons = document.querySelectorAll('.server-btn');
      buttons.forEach(btn => btn.classList.remove('active'));
      const activeButton = Array.from(buttons).find(btn => btn.textContent.trim() === 'Server 1');
      if (activeButton) activeButton.classList.add('active');
    }

    // Populate seasons and episodes if the item is a TV show
    if (currentItem.media_type === 'tv') {
      logDebug('Loading seasons and episodes...');
      populateSeasonsAndEpisodes(currentItem.id);
    }
  } catch (error) {
    logDebug(`Error in showDetails: ${error.message}`);
  }
}

function populateServerButtons() {
  try {
    const type = currentItem.media_type || (currentItem.first_air_date ? 'tv' : 'movie');
    const endpoints = type === 'movie' ? MOVIE_ENDPOINTS : TV_ENDPOINTS;
    const container = document.getElementById('server-buttons');
    if (!container) {
      logDebug('Error: server-buttons container not found');
      return;
    }
    logDebug(`Populating server buttons for type: ${type}`);
    container.innerHTML = '';
    
    const servers = [
      { name: 'Server 1', id: 'vidsrc.cc', url: 'https://vidsrc.cc/v2/embed' },
      { name: 'Server 2', id: 'vidsrc.me', url: 'https://vidsrc.me/embed' },
      { name: 'Server 3', id: 'player.videasy.net', url: 'https://player.videasy.net' },
      ...endpoints.map((endpoint, i) => ({ 
        name: `Server ${i + 4}`, 
        id: `server${i + 4}`, 
        url: endpoint 
      }))
    ];

    logDebug(`Created ${servers.length} server buttons`);
    servers.forEach(server => {
      const button = document.createElement('button');
      button.className = 'server-btn';
      button.textContent = server.name;
      button.dataset.server = server.id;
      button.dataset.url = server.url;
      button.onclick = () => changeServer(server.id);
      container.appendChild(button);
    });

    // Set first server as active by default
    const firstButton = container.querySelector('.server-btn');
    if (firstButton) {
      firstButton.classList.add('active');
      changeServer(firstButton.dataset.server);
    } else {
      logDebug('Error: No server buttons were created');
    }
  } catch (error) {
    logDebug(`Error in populateServerButtons: ${error.message}`);
  }
}

function changeServer(server) {
  if (!currentItem) {
    logDebug('No current item available');
    return;
  }

  // Update active button state
  const buttons = document.querySelectorAll('.server-btn');
  buttons.forEach(btn => btn.classList.remove('active'));
  const activeButton = Array.from(buttons).find(btn => btn.dataset.server === server);
  if (activeButton) {
    activeButton.classList.add('active');
  }

  const type = currentItem.media_type || (currentItem.first_air_date ? 'tv' : 'movie');
  
  // For TV shows, get current episode and season
  if (type === 'tv') {
    const activeEpisode = document.querySelector('.episode-item.active');
    const activeSeasonTab = document.querySelector('.season-tab.active');
    if (activeEpisode && activeSeasonTab) {
      const seasonNumber = activeSeasonTab.dataset.seasonNumber;
      const episodeNumber = activeEpisode.dataset.episodeNumber;
      const embedURL = getServerUrl(server, type, currentItem.id, seasonNumber, episodeNumber);
      updateVideoWithUrl(embedURL);
      return;
    }
  }

  // For movies or if no episode is selected  // For movies or if no episode was found
  const embedURL = getServerUrl(server, type, currentItem.id);
  updateVideoWithUrl(embedURL);
}

// Get server URL helper
function getServerUrl(server, type, id, season = '1', episode = '1') {
    if (!id || !type || !server) {
        logDebug('Missing required parameters for URL generation');
        return null;
    }

    const selectedSeason = season;
    const selectedEpisode = episode;

    logDebug(`Building URL - server: ${server}, type: ${type}, id: ${id}, season: ${selectedSeason}, episode: ${selectedEpisode}`);
    
    switch (server) {
        case 'vidsrc.cc':
            if (type === 'movie') {
                return `https://vidsrc.cc/v2/embed/movie/${id}`;
            }
            return `https://vidsrc.cc/v2/embed/tv/${id}/${selectedSeason}/${selectedEpisode}`;

        case 'vidsrc.me':
            if (type === 'movie') {
                return `https://vidsrc.me/embed/movie/${id}`;
            }
            return `https://vidsrc.me/embed/tv/${id}?s=${selectedSeason}&e=${selectedEpisode}`;

        case 'player.videasy.net':
            if (type === 'movie') {
                return `https://player.videasy.net/movie/${id}`;
            }
            return `https://player.videasy.net/tv/${id}/${selectedSeason}/${selectedEpisode}`;

        default:
            if (server.startsWith('server')) {
                const serverNum = parseInt(server.replace('server', ''));
                if (!isNaN(serverNum) && serverNum > 0) {
                    const endpoints = type === 'movie' ? MOVIE_ENDPOINTS : TV_ENDPOINTS;
                    const index = serverNum - 4;
                    if (index >= 0 && index < endpoints.length) {
                        const baseUrl = endpoints[index] + id;
                        if (type === 'movie') return baseUrl;
                        
                        // Server 3 specific URL pattern
                        if (serverNum === 3 && type === 'tv') {
                          const s3url = `${baseUrl}${selectedSeason}/${selectedEpisode}`;
                          logDebug(`Server 3 URL constructed: ${s3url}`);
                          return s3url;
                        }
                        
                        // Other server patterns
                        if (endpoints[index].includes('gdriveplayer')) {
                          return `${baseUrl}&s=${selectedSeason}&e=${selectedEpisode}`;
                        }
                        if (endpoints[index].includes('playtaku')) {
                          return `${baseUrl}&s=${selectedSeason}&ep=${selectedEpisode}`;
                        }
                        return `${baseUrl}?s=${selectedSeason}&e=${selectedEpisode}`;
                    }
                }
            }
            logDebug(`Unsupported server: ${server}`);
            return null;
    }
}

async function populateSeasonsAndEpisodes(showId) {
    logDebug(`populateSeasonsAndEpisodes called with showId: ${showId}`);
    const seasonTabs = document.getElementById('season-tabs');
    const episodesList = document.getElementById('episodes-list');

    try {
        const res = await fetch(`${BASE_URL}/tv/${showId}?api_key=${API_KEY}`);
        if (!res.ok) {
            logDebug(`Failed to fetch TV show details: ${res.statusText}`);
            return;
        }
        const data = await res.json();
        logDebug(`TV Show Details: ${JSON.stringify(data)}`);        // Populate season tabs
        seasonTabs.innerHTML = '';
        // Filter out season 0 and sort seasons by number
        const validSeasons = data.seasons
            .filter(season => season.season_number > 0)
            .sort((a, b) => a.season_number - b.season_number);

        validSeasons.forEach((season) => {
            const tab = document.createElement('button');
            tab.className = 'season-tab';
            tab.textContent = `Season ${season.season_number}`;
            tab.dataset.seasonNumber = season.season_number;
            tab.onclick = () => updateEpisodes(showId, season.season_number);
            seasonTabs.appendChild(tab);
        });

        // Add scroll check after populating tabs
        updateSeasonTabsScroll();
        window.addEventListener('resize', updateSeasonTabsScroll);        // Load first valid season by default
        if (validSeasons.length > 0) {
            const firstTab = seasonTabs.firstChild;
            firstTab.classList.add('active');
            updateEpisodes(showId, validSeasons[0].season_number);
            logDebug(`Loading first valid season: ${validSeasons[0].season_number}`);
        } else {
            logDebug('No valid seasons found');
            seasonTabs.innerHTML = '<div class="no-seasons">No seasons available</div>';
        }
    } catch (error) {
        logDebug(`Error in populateSeasonsAndEpisodes: ${error.message}`);
    }
}

async function updateEpisodes(showId, seasonNumber) {
    const episodesList = document.getElementById('episodes-list');
    const seasonTabs = document.getElementById('season-tabs');

    if (!episodesList || !seasonTabs) {
        logDebug('Required DOM elements not found');
        return;
    }

    // Show loading state
    episodesList.innerHTML = '<div class="loading-episodes">Loading episodes...</div>';

    // Update active season tab
    const tabs = seasonTabs.getElementsByClassName('season-tab');
    Array.from(tabs).forEach(tab => {
        tab.classList.toggle('active', tab.dataset.seasonNumber === String(seasonNumber));
    });

    // Store current active server
    const activeServerButton = document.querySelector('#server-buttons button.active');
    const currentServer = activeServerButton ? activeServerButton.dataset.server : null;

    try {
        const res = await fetch(`${BASE_URL}/tv/${showId}/season/${seasonNumber}?api_key=${API_KEY}`);
        
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const data = await res.json();
        
        if (!data) {
            throw new Error('No data received from the API');
        }

        logDebug(`Fetched ${data.episodes?.length || 0} episodes for season ${seasonNumber}`);

        // Clear episodes list
        episodesList.innerHTML = '';

        if (!data.episodes || data.episodes.length === 0) {
            episodesList.innerHTML = '<div class="no-episodes">No episodes available for this season.</div>';
            return;
        }

        data.episodes.forEach((episode) => {
            if (!episode) return; // Skip if episode data is invalid

            const episodeItem = document.createElement('div');
            episodeItem.className = 'episode-item';
            episodeItem.dataset.episodeNumber = episode.episode_number;
            
            const thumbnailSrc = episode.still_path ? 
                `${IMG_URL}${episode.still_path}` : 
                'placeholder.jpg';
            
            episodeItem.innerHTML = `
                <img class="episode-thumbnail" src="${thumbnailSrc}" 
                     alt="Episode ${episode.episode_number}" 
                     onerror="this.src='placeholder.jpg'">
                <div class="episode-info">
                    <div class="episode-number">Episode ${episode.episode_number}</div>
                    <div class="episode-title">${episode.name || `Episode ${episode.episode_number}`}</div>
                    <div class="episode-description">${episode.overview || 'No description available.'}</div>
                </div>
            `;

            episodeItem.onclick = () => handleEpisodeClick(episodeItem, currentServer, seasonNumber);
            episodesList.appendChild(episodeItem);
        });

        // Make the first episode active by default
        const firstEpisode = episodesList.firstElementChild;
        if (firstEpisode) {
            firstEpisode.classList.add('active');
            if (currentServer) {
                handleEpisodeClick(firstEpisode, currentServer, seasonNumber);
            }
        }
    } catch (error) {
        logDebug(`Error in updateEpisodes: ${error.message}`);
        episodesList.innerHTML = '<div class="no-episodes">Error loading episodes. Please try again.</div>';
    }
}

function updateVideoIframe() {
    const videoFrame = document.getElementById('modal-video');
    const activeServerButton = document.querySelector('#server-buttons button.active');
    
    if (!videoFrame || !activeServerButton || !currentItem) {
        logDebug('Missing required elements for video update');
        return;
    }

    // Ensure iframe has proper attributes
    videoFrame.setAttribute('allowfullscreen', 'true');
    videoFrame.setAttribute('allow', 'encrypted-media');
    videoFrame.setAttribute('sandbox', 'allow-forms allow-scripts allow-same-origin');
    
    const server = activeServerButton.dataset.server;
    logDebug(`Active server: ${server}`);
    
    const type = currentItem.media_type || (currentItem.first_air_date ? 'tv' : 'movie');
    logDebug(`Content type: ${type}`);

    // Get active episode
    const activeEpisode = document.querySelector('.episode-item.active');
    const activeTab = document.querySelector('.season-tab.active');
    const seasonNumber = activeTab ? activeTab.dataset.seasonNumber : '1';
    const episodeNumber = activeEpisode ? activeEpisode.dataset.episodeNumber : '1';

    logDebug(`Current season: ${seasonNumber}, episode: ${episodeNumber}`);
    
    const embedURL = getServerUrl(server, type, currentItem.id, seasonNumber, episodeNumber);    logDebug(`Generated embed URL: ${embedURL}`);
    if (!embedURL) {
        logDebug('Failed to generate embed URL');
        return;
    }

    try {
        const currentSrc = videoFrame.src;
        if (currentSrc === embedURL) {
            logDebug('URL unchanged, skipping update');
            return;
        }

    // Create a new iframe element with secure settings
        const newFrame = document.createElement('iframe');
        newFrame.id = 'modal-video';
        newFrame.className = 'protected-frame';
        
        // Set comprehensive security attributes
        newFrame.setAttribute('allowfullscreen', 'true');
        newFrame.setAttribute('allow', 'encrypted-media; picture-in-picture');
        newFrame.setAttribute('sandbox', 'allow-forms allow-scripts allow-same-origin allow-presentation');
        newFrame.setAttribute('loading', 'lazy');
        newFrame.setAttribute('referrerpolicy', 'no-referrer');
        
        // Create containment div for additional security
        const frameContainer = document.createElement('div');
        frameContainer.className = 'iframe-container';
        frameContainer.style.cssText = 'position: relative; width: 100%; height: 100%; overflow: hidden;';
        
        // Add protective overlay to prevent unwanted scripts
        const overlay = document.createElement('div');
        overlay.className = 'iframe-overlay';
        overlay.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; pointer-events: none;';
        
        // Add load event handler before setting src
        newFrame.onload = () => {
            logDebug(`Video loaded successfully from ${embedURL}`);
            try {
                // Additional security measures after load
                newFrame.contentWindow.postMessage({ type: 'protection-init' }, '*');
            } catch (e) {
                logDebug('Post-load security initialization skipped');
            }
        };

        // Enhanced error handling
        newFrame.onerror = (error) => {
            logDebug(`Error loading video from ${embedURL}: ${error}`);
            const nextServer = tryNextServer(server);
            if (nextServer) {
                logDebug(`Trying next server: ${nextServer}`);
                changeServer(nextServer);
            }
        };        // Set up security event listeners
        window.addEventListener('message', function(event) {
            if (event.source === newFrame.contentWindow) {
                logDebug('Received message from iframe');
            }
        }, false);

        // Wrap iframe setting in try-catch
        try {
            // Add frame to container
            frameContainer.appendChild(newFrame);
            frameContainer.appendChild(overlay);

            // Set the source after all security measures are in place
            newFrame.src = embedURL;

            // Replace the old iframe with the new contained one
            videoFrame.parentNode.replaceChild(frameContainer, videoFrame);
            logDebug(`Updated video frame with new source: ${embedURL}`);
        } catch (error) {
            logDebug(`Error setting up video frame: ${error.message}`);
            const nextServer = tryNextServer(server);
            if (nextServer) {
                logDebug(`Error recovery: trying next server: ${nextServer}`);
                changeServer(nextServer);
            }
        }
    } catch (error) {
        logDebug(`Error updating video frame: ${error.message}`);
        // Try falling back to a different server
        const nextServer = tryNextServer(server);
        if (nextServer) {
            logDebug(`Error recovery: trying next server: ${nextServer}`);
            changeServer(nextServer);
        }
    }
}

function updateEpisodeDescription() {
    const episodeSelect = document.getElementById('episode-select');
    const descriptionContainer = document.getElementById('episode-description');

    if (episodeSelect && descriptionContainer) {
        const selectedOption = episodeSelect.options[episodeSelect.selectedIndex];
        const description = selectedOption ? selectedOption.dataset.description : 'No description available.';
        descriptionContainer.textContent = description;
        logDebug(`Updated episode description: ${description}`);
    }
}

function closeModal() {
    const modal = document.getElementById('modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => { 
            modal.style.display = 'none';
            
            // Show appropriate content based on current view
            const browseContent = document.getElementById('browse-content');
            const mainContent = document.getElementById('main-content');
            const searchResults = document.getElementById('search-results');
            
            if (browseContent.style.display === 'block') {
                browseContent.style.display = 'block';
            } else if (searchResults.style.display === 'block') {
                searchResults.style.display = 'block';
            } else {
                mainContent.style.display = 'block';
            }
        }, 300);

        // Clear video source
        const videoFrame = document.getElementById('modal-video');
        if (videoFrame) {
            videoFrame.src = '';
        }
    }
}

function logDebug(message) {
    // Check if debug mode is enabled in localStorage or if we're in a development environment
    if (window.location.hostname === 'localhost' || localStorage.getItem('debug') === 'true') {
        console.log(message);
    }
}

// Helper functions
export function createStarRating(rating) {
  const container = document.createElement('div');
  container.className = 'rating';
  
  // Convert rating to 0-5 scale and round to nearest half
  const stars = Math.round(rating / 20 * 2) / 2;
  
  // Add full and half stars
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement('i');
    if (i <= stars) {
      star.className = 'fas fa-star';
    } else if (i - 0.5 === stars) {
      star.className = 'fas fa-star-half-alt';
    } else {
      star.className = 'far fa-star';
    }
    container.appendChild(star);
  }
  
  return container;
}

// Initialize event listeners
function initVideoModalEvents() {
    const seasonSelect = document.getElementById('season-select');
    const episodeSelect = document.getElementById('episode-select');

    if (seasonSelect) {
        seasonSelect.addEventListener('change', async () => {
            logDebug(`Season changed: ${seasonSelect.value}`);
            if (currentItem && currentItem.id) {
                try {
                    await updateEpisodes(currentItem.id, seasonSelect.value);
                    const activeServerButton = document.querySelector('#server-buttons button.active');
                    if (activeServerButton && activeServerButton.dataset.server) {
                        changeServer(activeServerButton.dataset.server);
                    }
                } catch (error) {
                    logDebug(`Error handling season change: ${error}`);
                }
            }
        });
    }

    if (episodeSelect) {
        episodeSelect.addEventListener('change', () => {
            logDebug(`Episode changed: ${episodeSelect.value}`);
            try {
                updateVideoIframe();
                updateEpisodeDescription();
            } catch (error) {
                logDebug(`Error handling episode change: ${error}`);
            }
        });
    }
}

function updateSeasonTabsScroll() {
    const seasonTabs = document.getElementById('season-tabs');
    const seasonsBar = document.querySelector('.seasons-bar');
    
    if (seasonTabs && seasonsBar) {
        // Check if content is scrollable
        const isScrollable = seasonTabs.scrollWidth > seasonTabs.clientWidth;
        seasonsBar.classList.toggle('has-scroll', isScrollable);
    }
}

// Export main functions
export {
  showDetails,
  closeModal,
  initVideoModalEvents,
  currentItem
};

function handleEpisodeClick(episodeItem, server, seasonNumber) {
    logDebug(`handleEpisodeClick called with episode ${episodeItem.dataset.episodeNumber}, season ${seasonNumber}, server ${server}`);

    // Update active state
    const allEpisodes = document.querySelectorAll('.episode-item');
    allEpisodes.forEach(ep => ep.classList.remove('active'));
    episodeItem.classList.add('active');

    // Update video with new episode using the updateVideoIframe function
    if (server && currentItem) {
        const type = currentItem.media_type || (currentItem.first_air_date ? 'tv' : 'movie');
        updateVideoIframe();
    }

    // Update episode description
    const description = episodeItem.querySelector('.episode-description');
    const descriptionContainer = document.getElementById('episode-description');
    if (description && descriptionContainer) {
        descriptionContainer.textContent = description.textContent;
    }
}

function tryNextServer(currentServer) {
    const servers = [
        'vidsrc.cc',
        'vidsrc.me',
        'player.videasy.net'
    ];
    
    const currentIndex = servers.indexOf(currentServer);
    if (currentIndex === -1 || currentIndex === servers.length - 1) {
        return servers[0]; // Wrap around to first server
    }
    return servers[currentIndex + 1];
}

// Add anti-interference handler
window.addEventListener('DOMContentLoaded', () => {
    // Override any attempts to modify the iframe
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.target.id === 'modal-video') {
                const iframe = mutation.target;
                const currentSrc = iframe.getAttribute('src');
                if (currentSrc && !currentSrc.includes('vidsrc') && !currentSrc.includes('videasy')) {
                    logDebug('Blocked unauthorized iframe source modification');
                    iframe.setAttribute('src', iframe.dataset.lastValidSrc || '');
                }
            }
        });
    });

    // Watch for changes to the iframe
    const config = { attributes: true, childList: false, subtree: false };
    const videoFrame = document.getElementById('modal-video');
    if (videoFrame) {
        observer.observe(videoFrame, config);
    }
});

function updateVideoWithUrl(embedURL) {
    if (!embedURL) {
        logDebug('Failed to generate URL for server');
        return;
    }

    const videoFrame = document.getElementById('modal-video');
    if (!videoFrame) {
        logDebug('Video frame element not found');
        return;
    }

    // Clear current content first
    videoFrame.src = '';
    
    // Short delay to ensure clearing happens
    setTimeout(() => {
        // Update iframe source
        videoFrame.src = embedURL;
        logDebug(`Updated video frame source to: ${embedURL}`);
        
        // Add load event handler
        videoFrame.onload = () => {
            logDebug('Video loaded successfully');
        };
        
        // Add error handler
        videoFrame.onerror = () => {
            logDebug('Failed to load video');
            videoFrame.src = '';
            // Try next server automatically if this is a numbered server
            if (server.startsWith('server')) {
                const currentIndex = parseInt(server.replace('server', ''));
                const nextServer = `server${currentIndex + 1}`;
                const buttons = document.querySelectorAll('.server-btn');
                const nextButton = Array.from(buttons).find(btn => btn.dataset.server === nextServer);
                
                if (nextButton) {
                    changeServer(nextButton.dataset.server);
                }
            }
        };
    }, 100);
}
