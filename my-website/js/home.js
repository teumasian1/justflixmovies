import { 
    showDetails, 
    closeModal, 
    initVideoModalEvents,
    API_KEY,
    BASE_URL,
    IMG_URL,
    BACKDROP_URL,
    POSTER_URL,
    currentItem,
    createStarRating
} from './videoModal.js';

import {
    toggleBrowseView,
    updateFilter,
    initBrowseView,
    changePage
} from './browse.js';

// Error handling and retry configuration
const MAX_INIT_RETRIES = 3;
const INIT_RETRY_DELAY = 1000;

// Retry wrapper
async function withRetry(fn, name = 'operation', retries = MAX_INIT_RETRIES) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            console.warn(`Attempt ${i + 1} failed for ${name}:`, error);
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, INIT_RETRY_DELAY));
        }
    }
}

// Expose functions needed by HTML with error handling
window.toggleBrowseView = (...args) => withRetry(() => toggleBrowseView(...args), 'toggleBrowseView');
window.updateFilter = (...args) => withRetry(() => updateFilter(...args), 'updateFilter');
window.initBrowseView = (...args) => withRetry(() => initBrowseView(...args), 'initBrowseView');
window.changePage = (...args) => withRetry(() => changePage(...args), 'changePage');
window.showDetails = (...args) => withRetry(() => showDetails(...args), 'showDetails');
window.closeModal = (...args) => withRetry(() => closeModal(...args), 'closeModal');

// Initialize with retry mechanism
document.addEventListener('DOMContentLoaded', () => {
    withRetry(() => {
        // Handle URL parameters if present
        const urlParams = new URLSearchParams(window.location.search);
        const itemId = urlParams.get('id');
        const itemType = urlParams.get('type');
        
        if (itemId && itemType) {
            // Fetch and show details for the item from URL
            fetch(`${BASE_URL}/${itemType}/${itemId}?api_key=${API_KEY}`)
                .then(response => response.json())
                .then(data => {
                    data.media_type = itemType;
                    showDetails(data);
                })
                .catch(error => {
                    console.error('Error fetching item details:', error);
                });
        }

        // Initialize video modal events
        initVideoModalEvents();
        // Initialize the application
        return init();
    }, 'initialization').catch(error => {
        console.error('Critical initialization error:', error);
        // Show user-friendly error message
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.innerHTML = `
                <div class="error-message" style="text-align: center; padding: 2rem;">
                    <h2>Oops! Something went wrong</h2>
                    <p>Please refresh the page to try again.</p>
                </div>
            `;
        }
    });
});

let currentBannerItem;

// Keep the movie-related constants
let bannerItems = [];
let currentBannerIndex = 0;
let bannerInterval;

async function fetchTrending(type) {
  const res = await fetch(`${BASE_URL}/trending/${type}/week?api_key=${API_KEY}`);
  const data = await res.json();
  console.log(`Fetched ${type} data:`, data.results);
  return data.results;
}

async function fetchTrendingAnime() {
  let allResults = [];

  // Fetch from multiple pages to get more anime (max 3 pages for demo)
  for (let page = 1; page <= 3; page++) {
    const res = await fetch(`${BASE_URL}/trending/tv/week?api_key=${API_KEY}&page=${page}`);
    const data = await res.json();
    const filtered = data.results.filter(item =>
      item.original_language === 'ja' && item.genre_ids.includes(16)
    );
    allResults = allResults.concat(filtered);
  }

  return allResults;
}

async function fetchTrendingKDramas() {
  let allResults = [];
  
  // Fetch from multiple pages to get more K-dramas
  for (let page = 1; page <= 3; page++) {
    const res = await fetch(`${BASE_URL}/discover/tv?api_key=${API_KEY}&with_original_language=ko&sort_by=popularity.desc&first_air_date.gte=2024-01-01&first_air_date.lte=2025-12-31&page=${page}`);
    const data = await res.json();
    // Filter to ensure we only get Korean dramas (exclude variety shows, etc.)
    const filtered = data.results.filter(item => 
      item.genre_ids.includes(18) // Drama genre
    );
    allResults = allResults.concat(filtered);
  }
  
  // Sort by popularity and return top results
  return allResults.sort((a, b) => b.popularity - a.popularity);
}

// Banner functions
function displayBanner(item) {
    currentBannerItem = item;
    const banner = document.getElementById('banner');
    banner.style.backgroundImage = `url(${BACKDROP_URL}${item.backdrop_path})`;
    document.getElementById('banner-title').textContent = item.title || item.name;
    document.getElementById('banner-overview').textContent = item.overview;
}

function nextBanner() {
    currentBannerIndex = (currentBannerIndex + 1) % bannerItems.length;
    displayBanner(bannerItems[currentBannerIndex]);
}

function startBannerSlideshow() {
    if (bannerInterval) {
        clearInterval(bannerInterval);
    }
    bannerInterval = setInterval(nextBanner, 5000); // Change banner every 5 seconds
}

// Video availability checking
async function checkVideoAvailability(item) {
    if (!item) return false;
    const type = item.media_type || (item.first_air_date ? 'tv' : 'movie');
    
    // Create an array of URLs to check in parallel
    const urls = [
        `https://vidsrc.cc/v2/embed/${type}/${item.id}`,
        `https://player.videasy.net/${type}/${item.id}`
    ];
    
    try {
        const checks = urls.map(url => 
            fetch(url, { 
                method: 'HEAD', 
                mode: 'no-cors',
                signal: AbortSignal.timeout(3000) // 3 second timeout
            })
            .then(response => response.type === 'opaque' || response.ok)
            .catch(() => false)
        );

        // If any URL is available, return true
        const results = await Promise.any(checks);
        return results === true;
    } catch (error) {
        console.warn(`No video available for ${type} ID: ${item.id}`);
        return false;
    }
}

// Display lists
async function displayList(items, containerId) {
    const container = document.getElementById(containerId);
    if (!container || !Array.isArray(items)) {
        console.warn(`Invalid container or items for ${containerId}`);
        return;
    }
    
    console.log(`Displaying ${items.length} items in ${containerId}`);
    
    // Clone the old container and replace it with a new one to remove old event listeners
    const oldContainer = container;
    const newContainer = oldContainer.cloneNode(false);
    newContainer.innerHTML = '';
    newContainer.classList.add('list'); // Add the list class while preserving others
    oldContainer.parentNode.replaceChild(newContainer, oldContainer);
    
    const itemsWithPosters = items.filter(item => item.poster_path);
    console.log(`Found ${itemsWithPosters.length} items with posters`);
    
    for (const item of itemsWithPosters) {
        try {
            const posterContainer = document.createElement('div');
            posterContainer.className = 'poster-container';
            posterContainer.dataset.itemId = item.id;
            
            const img = document.createElement('img');
            img.loading = 'lazy';
            
            // Add loading animation class and handlers
            posterContainer.classList.add('loading');
            
            img.onload = () => {
                console.log(`Image loaded for ${item.title || item.name}`);
                posterContainer.classList.remove('loading');
                posterContainer.classList.add('loaded');
            };
            
            img.onerror = () => {
                console.warn(`Image failed to load for ${item.title || item.name}`);
                posterContainer.classList.remove('loading');
                img.src = 'placeholder.jpg';
            };
            
            // Set up image loading
            const imageUrl = item.poster_path ? 
                `${IMG_URL}${item.poster_path}` : 
                'placeholder.jpg';
            
            console.log(`Loading image from ${imageUrl} for ${item.title || item.name}`);
            
            img.src = imageUrl;
            img.alt = item.title || item.name;
            
            const overlay = document.createElement('div');
            overlay.className = 'poster-overlay';
            
            const title = document.createElement('h3');
            title.className = 'poster-title';
            title.textContent = item.title || item.name;
            
            const starRating = createStarRating(item.vote_average * 10);
            
            const releaseYear = document.createElement('div');
            releaseYear.className = 'poster-year';
            releaseYear.textContent = new Date(item.release_date || item.first_air_date).getFullYear();
            
            const description = document.createElement('div');
            description.className = 'poster-description';
            description.textContent = item.overview;
            
            overlay.appendChild(title);
            overlay.appendChild(starRating);
            overlay.appendChild(releaseYear);
            overlay.appendChild(description);
            posterContainer.appendChild(img);
            posterContainer.appendChild(overlay);
            
            posterContainer.onclick = (e) => {
                e.preventDefault();
                showDetails(item);
            };
            
            newContainer.appendChild(posterContainer);
        } catch (error) {
            console.error(`Error creating poster: ${error.message}`);
        }
    }
    
    // Update loading state of container
    container.querySelectorAll('.loading-spinner').forEach(spinner => spinner.remove());
    console.log(`Finished loading posters for ${containerId}`);
}

// Search functions
function openSearchModal() {
    document.getElementById('search-modal').style.display = 'flex';
    document.getElementById('search-input').focus();
}

function closeSearchModal() {
    document.getElementById('search-modal').style.display = 'none';
    document.getElementById('search-results').innerHTML = '';
}

async function searchTMDB() {
    const query = document.getElementById('navbar-search').value;
    const resultsContainer = document.getElementById('navbar-search-results');
    const searchResultsSection = document.getElementById('search-results');
    const mainContent = document.getElementById('main-content');
    const browseContent = document.getElementById('browse-content');
  
    if (!query.trim()) {
        searchResultsSection.style.display = 'none';
        if (browseContent.style.display === 'block') {
            mainContent.style.display = 'none';
        } else {
            mainContent.style.display = 'block';
        }
        return;
    }

    // Show search results and hide other content
    mainContent.style.display = 'none';
    browseContent.style.display = 'none';
    searchResultsSection.style.display = 'block';

    // Show loading state
    resultsContainer.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Searching...</p></div>';

    try {
        const res = await fetch(`${BASE_URL}/search/multi?api_key=${API_KEY}&query=${query}`);
        const data = await res.json();
    
        resultsContainer.innerHTML = '';
        if (data.results.length > 0) {
            data.results.forEach(item => {
                if (!item.poster_path) return;
                const img = document.createElement('img');
                img.src = `${IMG_URL}${item.poster_path}`;
                img.alt = item.title || item.name;
                img.onclick = () => {
                    showDetails(item);
                    document.getElementById('navbar-search').value = '';
                    searchResultsSection.style.display = 'none';
                    mainContent.style.display = 'block';
                };
                resultsContainer.appendChild(img);
            });
        } else {
            resultsContainer.innerHTML = '<div class="no-results">No results found</div>';
        }
    } catch (error) {
        console.error('Search error:', error);
        resultsContainer.innerHTML = '<div class="no-results">Error searching. Please try again.</div>';
    }
}

// Close search results when clicking outside search container
document.addEventListener('click', (e) => {
    const searchBar = document.getElementById('navbar-search');
    const searchResultsSection = document.getElementById('search-results');
    const mainContent = document.getElementById('main-content');
    const browseContent = document.getElementById('browse-content');
  
    if (e.target !== searchBar && !searchResultsSection.contains(e.target)) {
        searchResultsSection.style.display = 'none';
        if (browseContent.style.display !== 'block') {
            mainContent.style.display = 'block';
        }
        searchBar.value = '';
    }
});

// Drag scrolling functionality
function initDragScroll() {
    const sliders = document.querySelectorAll('.list');
    const LONG_PRESS_THRESHOLD = 200;
  
    sliders.forEach(slider => {
        let isDown = false;
        let startX;
        let scrollLeft;
        let longPressTimer;
        let isDraggable = false;

        slider.addEventListener('mousedown', (e) => {
            startX = e.pageX - slider.offsetLeft;
            scrollLeft = slider.scrollLeft;
        
            longPressTimer = setTimeout(() => {
                isDown = true;
                isDraggable = true;
                slider.classList.add('dragging');
            }, LONG_PRESS_THRESHOLD);
        });

        slider.addEventListener('mouseleave', () => {
            isDown = false;
            isDraggable = false;
            clearTimeout(longPressTimer);
            slider.classList.remove('dragging');
        });

        slider.addEventListener('mouseup', () => {
            isDown = false;
            isDraggable = false;
            clearTimeout(longPressTimer);
            slider.classList.remove('dragging');
        });

        slider.addEventListener('mousemove', (e) => {
            if (!isDown || !isDraggable) return;
            e.preventDefault();
            const x = e.pageX - slider.offsetLeft;
            const walk = (x - startX) * 2;
            slider.scrollLeft = scrollLeft - walk;
        });

        slider.addEventListener('click', (e) => {
            if (isDraggable) {
                e.preventDefault();
                e.stopPropagation();
            }
        }, true);
    });
}

// Theme handling
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}

function toggleTheme() {
    const currentTheme = localStorage.getItem('theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
}

// Export for global use
window.searchTMDB = searchTMDB;
window.toggleTheme = toggleTheme;
window.setTheme = setTheme;
window.initTheme = initTheme;

// Initialize theme on page load
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
});

// Star rating functionality is now imported from videoModal.js

// Initialize event listeners for modal and banner
function initModalEvents() {
    // Modal close button
    const closeButton = document.getElementById('modal-close-button');
    if (closeButton) {
        closeButton.addEventListener('click', closeModal);
    }

    // Banner buttons
    const playButton = document.getElementById('banner-play-button');
    const infoButton = document.getElementById('banner-info-button');
    
    if (playButton) {
        playButton.addEventListener('click', () => {
            if (currentBannerItem) showDetails(currentBannerItem);
        });
    }
    
    if (infoButton) {
        infoButton.addEventListener('click', () => {
            if (currentBannerItem) showDetails(currentBannerItem);
        });
    }
}

// Initialize event listeners
function initializeEventListeners() {
    // Logo click
    document.getElementById('logo').addEventListener('click', () => {
        window.location.href = 'index.html';
    });

    // Browse button
    document.getElementById('browse-btn').addEventListener('click', () => {
        toggleBrowseView();
    });

    // Search input
    document.getElementById('navbar-search').addEventListener('input', () => {
        searchTMDB();
    });

    // Theme toggle
    document.getElementById('theme-toggle').addEventListener('click', () => {
        toggleTheme();
    });
}

// List initialization
function initListNavigation() {
    const lists = document.querySelectorAll('.list');
    lists.forEach(list => {
        let startX;
        let scrollLeft;
        let isScrolling = false;
        
        // Add touch scrolling support with improved handling
        list.addEventListener('touchstart', (e) => {
            isScrolling = true;
            startX = e.touches[0].pageX - list.offsetLeft;
            scrollLeft = list.scrollLeft;
            list.classList.add('dragging');
        }, { passive: true });

        list.addEventListener('touchmove', (e) => {
            if (!isScrolling) return;
            e.preventDefault();
            const x = e.touches[0].pageX - list.offsetLeft;
            const walk = (x - startX) * 2; // Multiply by 2 for faster scrolling
            list.scrollLeft = scrollLeft - walk;
        }, { passive: false });

        list.addEventListener('touchend', () => {
            isScrolling = false;
            list.classList.remove('dragging');
        }, { passive: true });

        // Add improved mouse drag scrolling
        let isDragging = false;
        let startPageX;

        list.addEventListener('mousedown', (e) => {
            isDragging = true;
            lastPageX = e.pageX;
            e.preventDefault();
        });        list.addEventListener('mousedown', (e) => {
            isDragging = true;
            startPageX = e.pageX;
            scrollLeft = list.scrollLeft;
            list.style.cursor = 'grabbing';
            list.classList.add('dragging');
            e.preventDefault();
        });

        list.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const x = e.pageX;
            const walk = (x - startPageX) * 2; // Multiply by 2 for faster scrolling
            list.scrollLeft = scrollLeft - walk;
        });

        const stopDragging = () => {
            isDragging = false;
            list.style.cursor = 'grab';
            list.classList.remove('dragging');
        };

        list.addEventListener('mouseup', stopDragging);
        list.addEventListener('mouseleave', stopDragging);
    });
}

// Initialization
async function init() {
    try {
        initTheme();
        initModalEvents();
        initDragScroll(); // Initialize drag scrolling
        
        const movies = await fetchTrending('movie');
        const tvShows = await fetchTrending('tv');
        const anime = await fetchTrendingAnime();
        const kdramas = await fetchTrendingKDramas();

        // Setup random banner items
        bannerItems = movies
            .sort(() => Math.random() - 0.5)
            .slice(0, 4)
            .filter(movie => movie.backdrop_path);

        if (bannerItems.length > 0) {
            displayBanner(bannerItems[0]);
            startBannerSlideshow();
        }
        
        // Add loading indicators
        ['movies-list', 'tvshows-list', 'anime-list', 'kdramas-list'].forEach(id => {
            const container = document.getElementById(id);
            if (container) {
                container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Loading content...</p></div>';
            }
        });

        // Load and display content
        await Promise.all([
            displayList(movies, 'movies-list'),
            displayList(tvShows, 'tvshows-list'),
            displayList(anime, 'anime-list'),
            displayList(kdramas, 'kdramas-list')
        ]);
        
        // Initialize list navigation after content is loaded
        initListNavigation();
    } catch (error) {
        console.error('Initialization error:', error);
    }
}

// Initialize event listeners
document.addEventListener('DOMContentLoaded', () => {
    withRetry(() => {
        // Initialize video modal events
        initVideoModalEvents();
        // Initialize event listeners
        initializeEventListeners();
        // Initialize the application
        return init();
    }, 'initialization').catch(error => {
        console.error('Critical initialization error:', error);
        // Show user-friendly error message
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.innerHTML = `
                <div class="error-message" style="text-align: center; padding: 2rem;">
                    <h2>Oops! Something went wrong</h2>
                    <p>Please refresh the page to try again.</p>
                </div>
            `;
        }
    });
});
