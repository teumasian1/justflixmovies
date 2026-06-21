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

// Event listener for browser back/forward buttons
window.addEventListener('popstate', (event) => {
    if (event.state && event.state.id) {
        // Re-fetch and show the item when navigating through history
        fetch(`${BASE_URL}/${event.state.type}/${event.state.id}?api_key=${API_KEY}`)
            .then(response => response.json())
            .then(data => {
                data.media_type = event.state.type;
                showDetails(data);
            })
            .catch(error => {
                logDebug(`Error fetching item details: ${error}`);
            });
    } else {
        // Close modal if navigating back to base URL
        closeModal();
    }
});

function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 80);
}

function isLocalhost() {
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

function buildItemUrl(type, slug, id) {
    const path = `/${type}/${slug}-${id}`;
    return isLocalhost() ? `/#${path}` : path;
}

// Main function to show video modal
// ===== Typewriter reveal for the modal title + description =====
let typewriterTimers = [];
// Delay (ms) before the modal typewriter starts. launchFromPoster raises this
// so typing only begins once the full-screen launch overlay has dissolved.
let modalTypeDelay = 420;

function clearTypewriter() {
  typewriterTimers.forEach((t) => clearTimeout(t));
  typewriterTimers = [];
}

function typeWriter(el, text, { speed = 28, startDelay = 0 } = {}) {
  if (!el) return;
  text = text || '';
  el.classList.remove('tw-typing', 'tw-done');
  el.textContent = '';
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !text) {
    el.textContent = text;
    el.classList.add('tw-done');
    return;
  }
  let i = 0;
  const step = () => {
    i++;
    el.textContent = text.slice(0, i);
    if (i < text.length) {
      typewriterTimers.push(setTimeout(step, speed));
    } else {
      el.classList.remove('tw-typing');
      el.classList.add('tw-done');
    }
  };
  el.classList.add('tw-typing');
  typewriterTimers.push(setTimeout(step, startDelay));
}

async function showDetails(item) {
  try {
    currentItem = item;
    logDebug(`Showing details for: ${item.title || item.name}`);
    
    // Update URL with movie/show information for SEO
    const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
    const slug = slugify(item.title || item.name);
    const newUrl = buildItemUrl(mediaType, slug, item.id);
    window.history.pushState({ type: mediaType, id: item.id }, '', newUrl);
    
    // Update page meta tags for SEO
    document.title = `${item.title || item.name} - JustFlixMovies`;
    document.querySelector('meta[name="description"]').setAttribute('content', item.overview);
    document.querySelector('meta[property="og:title"]').setAttribute('content', `${item.title || item.name} - JustFlixMovies`);
    document.querySelector('meta[property="og:description"]').setAttribute('content', item.overview);
    document.querySelector('meta[property="og:url"]').setAttribute('content', window.location.href);
    if (item.poster_path) {
      document.querySelector('meta[property="og:image"]').setAttribute('content', `${IMG_URL}${item.poster_path}`);
    }
    // Self-referential canonical so each title indexes as its own page
    // (was hard-coded to the homepage, which collapsed every deep link into one URL).
    const canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink && !isLocalhost()) {
      canonicalLink.setAttribute('href', `${window.location.origin}${newUrl}`);
    }

    // Add structured data
    const structuredData = {
      '@context': 'https://schema.org',
      '@type': mediaType === 'movie' ? 'Movie' : 'TVSeries',
      'name': item.title || item.name,
      'description': item.overview,
      'image': item.poster_path ? `${IMG_URL}${item.poster_path}` : undefined,
      'datePublished': item.release_date || item.first_air_date,
      'aggregateRating': {
        '@type': 'AggregateRating',
        'ratingValue': item.vote_average,
        'ratingCount': item.vote_count,
        'bestRating': 10,
        'worstRating': 0
      }
    };

    // Update or create structured data script tag
    let scriptTag = document.querySelector('#structured-data');
    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.id = 'structured-data';
      scriptTag.type = 'application/ld+json';
      document.head.appendChild(scriptTag);
    }
    scriptTag.textContent = JSON.stringify(structuredData);
    
    const modal = document.getElementById('modal');
    if (!modal) {
      logDebug('Error: Modal container not found');
      return;
    }

    // Hide main content and show modal
    document.getElementById('main-content').style.display = 'none';
    document.getElementById('search-results').style.display = 'none';
    document.getElementById('browse-content').style.display = 'none';
    
    modal.classList.add('show');
    
    // Set modal content
    // Typewriter reveal — title types first, then the description.
    clearTypewriter();
    const twTitle = item.title || item.name || '';
    const twDesc = item.overview || '';
    const twDelay = modalTypeDelay;
    modalTypeDelay = 420; // reset to default for the next (direct) open
    const titleSpeed = 40;
    typeWriter(document.getElementById('modal-title'), twTitle, { speed: titleSpeed, startDelay: twDelay });
    typeWriter(document.getElementById('modal-description'), twDesc, {
      speed: 10,
      startDelay: twDelay + twTitle.length * titleSpeed + 220,
    });
    document.getElementById('modal-image').src = `${IMG_URL}${item.poster_path}`;
    document.getElementById('modal-rating').innerHTML = '★'.repeat(Math.round(item.vote_average / 2));
    document.getElementById('modal-year').textContent = new Date(item.release_date || item.first_air_date).getFullYear();
      // Set media type
    currentItem.media_type = currentItem.media_type || (currentItem.first_air_date ? 'tv' : 'movie');
    logDebug(`Media type set to: ${currentItem.media_type}`);

    // Show/hide season and episode section based on media type
    const episodesSection = document.querySelector('.episodes-section');
    const modalContent = document.querySelector('.modal-content');
    
    // Clear old data immediately to prevent flickering of wrong episodes
    const seasonTabs = document.getElementById('season-tabs');
    const episodesList = document.getElementById('episodes-list');
    if (seasonTabs) seasonTabs.innerHTML = '';
    if (episodesList) episodesList.innerHTML = '';

    if (episodesSection) {
      episodesSection.style.display = currentItem.media_type === 'tv' ? 'flex' : 'none';
      
      // Update Grid Layout Class
      if (modalContent) {
          if (currentItem.media_type === 'tv') {
              modalContent.classList.remove('is-movie-modal');
              modalContent.classList.add('is-tv-modal');
          } else {
              modalContent.classList.remove('is-tv-modal');
              modalContent.classList.add('is-movie-modal');
          }
      }
    }

    const seasonPicker = document.getElementById('season-picker');
    const seasonDropdown = document.getElementById('season-dropdown');
    if (seasonPicker) {
      seasonPicker.style.display = currentItem.media_type === 'tv' ? 'flex' : 'none';
    }
    if (seasonDropdown && currentItem.media_type !== 'tv') {
      seasonDropdown.innerHTML = '';
    }

    // Show/hide season and episode dropdowns based on media type
    const modalDropdowns = document.querySelector('.modal-dropdowns');
    if (modalDropdowns) {
      modalDropdowns.style.display = currentItem.media_type === 'tv' ? 'flex' : 'none';
    }
    
    // Populate server buttons
    logDebug('Populating server buttons...');
    populateServerButtons();

    if (currentItem.media_type === 'tv') {
      const serverContainer = document.getElementById('server-buttons');
      if (serverContainer && !serverContainer.querySelector('#server-dropdown')) {
        populateServerButtons();
      }
      updateEpisodeNavButtons();
    } else {
      resetTvOnlyControls();
    }
    
    // Start loading seasons/episodes in parallel (for TV shows)
    let seasonsPromise = Promise.resolve();
    if (currentItem.media_type === 'tv') {
      logDebug('Loading seasons and episodes in parallel...');
      seasonsPromise = populateSeasonsAndEpisodes(currentItem.id);
    }

    // Try all servers in parallel and select the first working one
    const type = currentItem.media_type;
    const servers = [
      { id: 'vidup.to' },
      { id: 'vidsrc.me' },
      { id: 'player.videasy.net' }
    ];

    const probeServer = async (serverId) => {
      const url = getServerUrl(serverId, type, currentItem.id);
      if (!url) return null;
      try {
        logDebug(`Testing server ${serverId} with URL: ${url}`);
        const response = await fetch(url, { method: 'HEAD', mode: 'no-cors' });
        if (response.ok || response.type === 'opaque') {
          logDebug(`Server ${serverId} is working`);
          return serverId;
        }
      } catch (e) {
        logDebug(`Error testing server ${serverId}: ${e.message}`);
      }
      return null;
    };

    const probes = servers.map(server => probeServer(server.id));
    let found = false;
    const pending = new Set(probes);
    while (pending.size > 0 && !found) {
      const winner = await Promise.race(
        [...pending].map(p => p.then(result => ({ result, promise: p })))
      );
      pending.delete(winner.promise);
      if (winner.result) {
        changeServer(winner.result);
        found = true;
      }
    }

    // If none work, fallback to first
    if (!found) {
      logDebug('No working servers found, falling back to default');
      changeServer('vidup.to');
    }

    // Wait for seasons/episodes to finish loading
    await seasonsPromise;
  } catch (error) {
    logDebug(`Error in showDetails: ${error.message}`);
  }
}

function populateServerButtons() {
  try {
    const type = currentItem.media_type || (currentItem.first_air_date ? 'tv' : 'movie');
    const container = document.getElementById('server-buttons');
    if (!container) {
      logDebug('Error: server-buttons container not found');
      return;
    }
    logDebug(`Populating server buttons for type: ${type}`);
    container.innerHTML = '';
    
    const servers = [
      { name: 'Server 1', id: 'vidup.to', url: 'https://vidup.to' },
      { name: 'Server 2', id: 'vidsrc.me', url: 'https://vidsrc.me/embed' },
      { name: 'Server 3', id: 'player.videasy.net', url: 'https://player.videasy.net' },
      { name: 'Server 4', id: 'embed.filmu.in', url: 'https://embed.filmu.in' },
      { name: 'Server 5', id: 'cinemaos.tech', url: 'https://cinemaos.tech' }
    ];

    logDebug(`Created ${servers.length} server options`);
    
    container.innerHTML = '<select id="server-dropdown" class="server-dropdown"></select>';
    const select = container.querySelector('#server-dropdown');

    servers.forEach(server => {
      const option = document.createElement('option');
      option.value = server.id;
      option.textContent = server.name;
      option.dataset.url = server.url;
      select.appendChild(option);
    });

    select.addEventListener('change', (e) => changeServer(e.target.value));
  } catch (error) {
    logDebug(`Error in populateServerButtons: ${error.message}`);
  }
}

function renderSeasonDropdown(validSeasons, selectedSeason = null) {
    const seasonPicker = document.getElementById('season-picker');
    const seasonDropdown = document.getElementById('season-dropdown');

    if (!seasonPicker || !seasonDropdown) return;

    if (!currentItem || currentItem.media_type !== 'tv' || !Array.isArray(validSeasons) || validSeasons.length === 0) {
        seasonDropdown.innerHTML = '';
        seasonPicker.style.display = 'none';
        return;
    }

    seasonPicker.style.display = 'flex';

    const preferredSeason = String(selectedSeason || seasonDropdown.value || validSeasons[0].season_number);
    seasonDropdown.innerHTML = '';

    validSeasons.forEach((season) => {
        const option = document.createElement('option');
        option.value = String(season.season_number);
        option.textContent = `Season ${season.season_number}`;
        seasonDropdown.appendChild(option);
    });

    const hasPreferred = validSeasons.some(season => String(season.season_number) === preferredSeason);
    seasonDropdown.value = hasPreferred ? preferredSeason : String(validSeasons[0].season_number);
}

function resetTvOnlyControls() {
    const seasonPicker = document.getElementById('season-picker');
    const seasonDropdown = document.getElementById('season-dropdown');
    const nav = document.getElementById('episode-nav');
    const prevBtn = document.getElementById('prev-ep-btn');
    const nextBtn = document.getElementById('next-ep-btn');
    const display = document.getElementById('current-ep-display');

    if (seasonPicker) {
        seasonPicker.style.display = 'none';
    }

    if (seasonDropdown) {
        seasonDropdown.innerHTML = '';
    }

    if (nav) {
        nav.style.display = 'none';
    }

    if (display) {
        display.textContent = '-';
    }

    if (prevBtn) {
        prevBtn.disabled = true;
    }

    if (nextBtn) {
        nextBtn.disabled = true;
    }
}

function changeServer(server) {
  if (!currentItem) {
    logDebug('No current item available');
    return;
  }

  // Update active dropdown state
  const dropdown = document.getElementById('server-dropdown');
  if (dropdown && dropdown.value !== server) {
    dropdown.value = server;
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
        case 'vidup.to':
            if (type === 'movie') {
                return `https://vidup.to/movie/${id}`;
            }
            return `https://vidup.to/tv/${id}/${selectedSeason}/${selectedEpisode}`;

        case 'vidlink.pro':
            if (type === 'movie') {
                return `https://vidlink.pro/movie/${id}`;
            }
            return `https://vidlink.pro/tv/${id}/${selectedSeason}/${selectedEpisode}`;

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

        case 'embed.filmu.in':
            if (type === 'movie') {
                return `https://embed.filmu.in/movie/${id}`;
            }
            return `https://embed.filmu.in/tv/${id}/${selectedSeason}/${selectedEpisode}`;

        case 'cinemaos.tech':
            if (type === 'movie') {
                return `https://cinemaos.tech/player/${id}`;
            }
            return `https://cinemaos.tech/player/${id}/${selectedSeason}/${selectedEpisode}`;

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
        const validSeasons = (data.seasons || [])
            .filter(season => season.season_number > 0)
            .sort((a, b) => a.season_number - b.season_number);

        renderSeasonDropdown(validSeasons);

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
            renderSeasonDropdown(validSeasons, validSeasons[0].season_number);
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
    const seasonDropdown = document.getElementById('season-dropdown');

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
    if (seasonDropdown) {
        seasonDropdown.value = String(seasonNumber);
    }

    // Store current active server
    let serverDropdown = document.getElementById('server-dropdown');
    if (!serverDropdown) {
        populateServerButtons();
        serverDropdown = document.getElementById('server-dropdown');
    }
    const currentServer = serverDropdown ? serverDropdown.value : 'vidsrc.cc';

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
            updateEpisodeNavButtons();
            return;
        }

        data.episodes.forEach((episode) => {
            if (!episode) return; // Skip if episode data is invalid

            const episodeItem = document.createElement('div');
            episodeItem.className = 'episode-item';
            episodeItem.dataset.episodeNumber = episode.episode_number;
            
            const thumbnailSrc = episode.still_path ? 
                `${IMG_URL}${episode.still_path}` : 
                '/placeholder.jpg';
            
            episodeItem.innerHTML = `
                <img class="episode-thumbnail" src="${thumbnailSrc}" 
                     alt="Episode ${episode.episode_number}" 
                     onerror="this.src='/placeholder.jpg'">
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
            handleEpisodeClick(firstEpisode, currentServer, seasonNumber);
        } else {
            updateEpisodeNavButtons();
        }
    } catch (error) {
        logDebug(`Error in updateEpisodes: ${error.message}`);
        episodesList.innerHTML = '<div class="no-episodes">Error loading episodes. Please try again.</div>';
        updateEpisodeNavButtons();
    }
}
function updateVideoIframe() {
    const dropdown = document.getElementById('server-dropdown');
    
    if (!dropdown || !currentItem) {
        logDebug('Missing required elements for video update');
        return;
    }

    const server = dropdown.value;
    logDebug(`Active server: ${server}`);
    
    const type = currentItem.media_type || (currentItem.first_air_date ? 'tv' : 'movie');
    logDebug(`Content type: ${type}`);

    // Get active episode
    const activeEpisode = document.querySelector('.episode-item.active');
    const activeTab = document.querySelector('.season-tab.active');
    const seasonNumber = activeTab ? activeTab.dataset.seasonNumber : '1';
    const episodeNumber = activeEpisode ? activeEpisode.dataset.episodeNumber : '1';

    logDebug(`Current season: ${seasonNumber}, episode: ${episodeNumber}`);
    
    const embedURL = getServerUrl(server, type, currentItem.id, seasonNumber, episodeNumber);
    logDebug(`Generated embed URL: ${embedURL}`);
    if (!embedURL) {
        logDebug('Failed to generate embed URL');
        return;
    }

    try {
        const videoFrame = document.getElementById('modal-video');
        if (videoFrame && videoFrame.src === embedURL) {
            logDebug('URL unchanged, skipping update');
            return;
        }

        recreateVideoIframe(embedURL);
    } catch (error) {
        logDebug(`Error updating video frame: ${error.message}`);
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

        // Drop the prerendered SEO fallback block (poster/title/description that
        // the /movie/* and /tv/* static pages inject for crawlers). It lives
        // outside #main-content, so it would otherwise linger above the home
        // view once the modal closes. Removing it here — in response to the
        // close interaction — keeps it present during initial load (no
        // load-time layout shift), and any shift from removal is excluded from
        // CLS because it happens within 500ms of user input.
        document.querySelector('.detail-seo')?.remove();

        // Remove URL parameters when closing modal
        window.history.pushState({}, '', isLocalhost() ? '/#' : '/');

        // Restore homepage canonical so the index doesn't keep a stale title canonical
        const canonicalLink = document.querySelector('link[rel="canonical"]');
        if (canonicalLink && !isLocalhost()) {
            canonicalLink.setAttribute('href', window.location.origin + '/');
        }

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

        // Clear video source after transition
        setTimeout(() => {
            const videoFrame = document.getElementById('modal-video');
            if (videoFrame) {
                videoFrame.src = '';
            }
        }, 300);
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
    const seasonDropdown = document.getElementById('season-dropdown');
    const episodeSelect = document.getElementById('episode-select');

    if (seasonDropdown && !seasonDropdown.dataset.bound) {
        seasonDropdown.dataset.bound = 'true';
        seasonDropdown.addEventListener('change', async () => {
            logDebug(`Season changed: ${seasonDropdown.value}`);
            if (currentItem && currentItem.id) {
                try {
                    await updateEpisodes(currentItem.id, seasonDropdown.value);
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
    
    const prevBtn = document.getElementById('prev-ep-btn');
    const nextBtn = document.getElementById('next-ep-btn');

    if (prevBtn && !prevBtn.dataset.bound) {
        prevBtn.dataset.bound = 'true';
        prevBtn.addEventListener('click', () => {
            const activeEpisode = document.querySelector('.episode-item.active');
            if (activeEpisode && activeEpisode.previousElementSibling) {
                const prev = activeEpisode.previousElementSibling;
                const serverDropdown = document.querySelector('#server-dropdown');
                const server = serverDropdown ? serverDropdown.value : null;
                const activeTab = document.querySelector('.season-tab.active');
                const season = activeTab ? activeTab.dataset.seasonNumber : '1';
                handleEpisodeClick(prev, server, season);
            }
        });
    }

    if (nextBtn && !nextBtn.dataset.bound) {
        nextBtn.dataset.bound = 'true';
        nextBtn.addEventListener('click', () => {
            const activeEpisode = document.querySelector('.episode-item.active');
            if (activeEpisode && activeEpisode.nextElementSibling) {
                const next = activeEpisode.nextElementSibling;
                const serverDropdown = document.querySelector('#server-dropdown');
                const server = serverDropdown ? serverDropdown.value : null;
                const activeTab = document.querySelector('.season-tab.active');
                const season = activeTab ? activeTab.dataset.seasonNumber : '1';
                handleEpisodeClick(next, server, season);
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

// ===== Grand "hero" launch =====
// On poster click, the poster artwork and a neon play puck fly to the center
// of the screen as the modal opens, so the click visibly travels into the
// player. Falls back to a plain open when reduced motion is on or the source
// element/image is unavailable.
function launchFromPoster(sourceEl, item) {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const img = sourceEl && sourceEl.querySelector ? sourceEl.querySelector('img') : null;
  const rect = img ? img.getBoundingClientRect() : null;
  if (reduce || !rect || !rect.width || !rect.height) {
    showDetails(item);
    return;
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const layer = document.createElement('div');
  layer.className = 'poster-launch-layer flash';

  // Poster artwork clone
  const clone = document.createElement('div');
  clone.className = 'poster-launch';
  clone.style.left = rect.left + 'px';
  clone.style.top = rect.top + 'px';
  clone.style.width = rect.width + 'px';
  clone.style.height = rect.height + 'px';
  clone.style.backgroundImage = `url("${img.currentSrc || img.src}")`;

  // Neon play puck, starting over the poster and travelling to centre
  const pcx = rect.left + rect.width / 2;
  const pcy = rect.top + rect.height / 2;
  const puck = document.createElement('div');
  puck.className = 'poster-launch-puck';
  puck.style.left = pcx + 'px';
  puck.style.top = pcy + 'px';
  puck.style.setProperty('--dx', (vw / 2 - pcx) + 'px');
  puck.style.setProperty('--dy', (vh / 2 - pcy) + 'px');

  layer.appendChild(clone);
  layer.appendChild(puck);
  document.body.appendChild(layer);

  // Full FLIP: expand the poster to COVER the whole viewport (uniform scale +
  // crop, so the artwork never distorts), then dissolve to the player.
  const coverScale = Math.max(vw / rect.width, vh / rect.height);
  const targetX = (vw - rect.width * coverScale) / 2;
  const targetY = (vh - rect.height * coverScale) / 2;

  requestAnimationFrame(() => {
    clone.style.transform = `translate(${targetX - rect.left}px, ${targetY - rect.top}px) scale(${coverScale})`;
    clone.style.borderRadius = '0';
    puck.classList.add('go');
  });

  // Open the modal under the expanding poster, then dissolve the overlay to it.
  // Hold the typewriter until the overlay has cleared (~1020ms launch-relative).
  modalTypeDelay = 820;
  setTimeout(() => showDetails(item), 240);
  setTimeout(() => { layer.style.opacity = '0'; }, 660);
  setTimeout(() => layer.remove(), 1020);
}

// Export main functions
export {
  showDetails,
  launchFromPoster,
  closeModal,
  initVideoModalEvents,
  currentItem
};

function updateEpisodeNavButtons() {
    const prevBtn = document.getElementById('prev-ep-btn');
    const nextBtn = document.getElementById('next-ep-btn');
    const display = document.getElementById('current-ep-display');
    const nav = document.getElementById('episode-nav');
    
    if (!prevBtn || !nextBtn || !display || !nav) return;

    if (!currentItem || currentItem.media_type !== 'tv') {
        nav.style.display = 'none';
        return;
    }
    
    nav.style.display = 'flex';
    
    const activeEpisode = document.querySelector('.episode-item.active');
    if (!activeEpisode) {
        display.textContent = '-';
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        return;
    }
    
    display.textContent = activeEpisode.dataset.episodeNumber;
    
    // Check if prev/next exist in current list
    prevBtn.disabled = !activeEpisode.previousElementSibling;
    nextBtn.disabled = !activeEpisode.nextElementSibling;
}

function handleEpisodeClick(episodeItem, server, seasonNumber) {
    logDebug(`handleEpisodeClick called with episode ${episodeItem.dataset.episodeNumber}, season ${seasonNumber}, server ${server}`);

    // Update active state
    const allEpisodes = document.querySelectorAll('.episode-item');
    allEpisodes.forEach(ep => ep.classList.remove('active'));
    episodeItem.classList.add('active');

    // Update video with new episode using the updateVideoIframe function
    if (server || currentItem) {
        updateVideoIframe();
    }

    // Update episode description
    const description = episodeItem.querySelector('.episode-description');
    const descriptionContainer = document.getElementById('episode-description');
    if (description && descriptionContainer) {
        descriptionContainer.textContent = description.textContent;
    }
    
    updateEpisodeNavButtons();
}

function tryNextServer(currentServer) {
    const servers = [
        'vidup.to',
        'vidsrc.me',
        'player.videasy.net',
        'embed.filmu.in'
    ];

    const currentIndex = servers.indexOf(currentServer);
    if (currentIndex === -1 || currentIndex === servers.length - 1) {
        return servers[0]; // Wrap around to first server
    }
    return servers[currentIndex + 1];
}

// Anti-interference observer
const allowedDomains = ['vidup.to', 'vidsrc', 'videasy', 'vidlink.pro', '111movies.com', 'vidjoy.pro', '2embed.cc', 'moviesapi.club', 'multiembed.mov', 'embedmovie.net', 'gdriveplayer.us'];

const iframeObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.target.id === 'modal-video') {
            const iframe = mutation.target;
            const currentSrc = iframe.getAttribute('src');
            if (currentSrc && !allowedDomains.some(domain => currentSrc.includes(domain))) {
                logDebug('Blocked unauthorized iframe source modification');
                iframe.setAttribute('src', iframe.dataset.lastValidSrc || '');
            }
        }
    });
});

window.addEventListener('DOMContentLoaded', () => {
    const videoFrame = document.getElementById('modal-video');
    if (videoFrame) {
        iframeObserver.observe(videoFrame, { attributes: true, childList: false, subtree: false });
    }
});

// Recreates iframe to bypass mobile browser fullscreen bugs when changing src
function recreateVideoIframe(embedURL) {
    const container = document.querySelector('.video-container');
    if (!container) return null;

    // Remove old iframe first to fully reset browser state
    container.innerHTML = '';

    // Create iframe via DOM API and set properties directly on the element
    // This ensures the browser's security model processes each attribute correctly
    const newFrame = document.createElement('iframe');
    newFrame.id = 'modal-video';
    newFrame.src = embedURL;
    newFrame.frameBorder = '0';
    
    // Fullscreen permissions - set both as attributes AND properties
    newFrame.allowFullscreen = true;
    newFrame.setAttribute('allowfullscreen', '');
    newFrame.setAttribute('webkitallowfullscreen', '');
    newFrame.setAttribute('mozallowfullscreen', '');
    
    // Permissions Policy - grant fullscreen to all origins (critical for nested iframes)
    newFrame.setAttribute('allow', 'fullscreen *; encrypted-media *; picture-in-picture *; autoplay *');
    
    newFrame.dataset.lastValidSrc = embedURL;

    newFrame.onload = () => logDebug('Video loaded successfully');
    newFrame.onerror = () => {
        logDebug('Failed to load video');
        const dropdown = document.getElementById('server-dropdown');
        const currentServer = dropdown ? dropdown.value : '';
        const nextServer = tryNextServer(currentServer);
        if (nextServer && currentServer !== nextServer) {
            changeServer(nextServer);
        }
    };

    // Append to container (inserting into DOM triggers attribute parsing)
    container.appendChild(newFrame);
    
    iframeObserver.observe(newFrame, { attributes: true, childList: false, subtree: false });
    logDebug(`Recreated video frame source: ${embedURL}`);
    return newFrame;
}

function updateVideoWithUrl(embedURL) {
    if (!embedURL) {
        logDebug('Failed to generate URL for server');
        return;
    }
    recreateVideoIframe(embedURL);
}
