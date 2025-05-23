const API_KEY = 'f7969edc09425407417da271f5077c89';
    const BASE_URL = 'https://api.themoviedb.org/3';
    const IMG_URL = 'https://image.tmdb.org/t/p/original';
    let currentItem;
    let bannerItems = [];
    let currentBannerIndex = 0;
    let bannerInterval;

    // Remove vidsrc.me from endpoints and server logic
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

    async function fetchTrending(type) {
      const res = await fetch(`${BASE_URL}/trending/${type}/week?api_key=${API_KEY}`);
      const data = await res.json();
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
        const res = await fetch(`${BASE_URL}/discover/tv?api_key=${API_KEY}&with_original_language=ko&sort_by=popularity.desc&page=${page}`);
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

    function displayBanner(item) {
        currentBannerItem = item;
        const banner = document.getElementById('banner');
        banner.style.backgroundImage = `url(${IMG_URL}${item.backdrop_path})`;
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
    }    async function displayList(items, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  
  // First, display all posters immediately
  items.forEach(item => {
    if (!item.poster_path) return;
    
    const posterContainer = document.createElement('div');
    posterContainer.className = 'poster-container';
    posterContainer.dataset.itemId = item.id; // Add ID for reference
    
    const img = document.createElement('img');
    img.src = `${IMG_URL}${item.poster_path}`;
    img.alt = item.title || item.name;
    
    const overlay = document.createElement('div');
    overlay.className = 'poster-overlay';
    
    const title = document.createElement('h3');
    title.className = 'poster-title';
    title.textContent = item.title || item.name;
    
    const rating = document.createElement('div');
    rating.className = 'poster-rating';
    rating.innerHTML = '★'.repeat(Math.round(item.vote_average / 2));
    
    const releaseYear = document.createElement('div');
    releaseYear.className = 'poster-year';
    releaseYear.textContent = new Date(item.release_date || item.first_air_date).getFullYear();
    
    const description = document.createElement('div');
    description.className = 'poster-description';
    description.textContent = item.overview;
    
    overlay.appendChild(title);
    overlay.appendChild(rating);
    overlay.appendChild(releaseYear);
    overlay.appendChild(description);
      posterContainer.appendChild(img);
    posterContainer.appendChild(overlay);
    container.appendChild(posterContainer);
    
    // Make content immediately clickable
    posterContainer.style.opacity = '1';
    posterContainer.onclick = () => showDetails(item);
  });

  // Then check availability in parallel
  const availabilityChecks = items
    .filter(item => item.poster_path)
    .map(async item => {
      try {
        const isAvailable = await checkVideoAvailability(item);
        const posterContainer = container.querySelector(`[data-itemId="${item.id}"]`);
        if (!posterContainer) return;

        if (!isAvailable) {
          posterContainer.remove();
        }
      } catch (error) {
        console.error('Error checking availability:', error);
      }
    });

  // Wait for all checks to complete
  await Promise.all(availabilityChecks);
}    async function showDetails(item) {
  currentItem = item;
  document.getElementById('modal').style.display = 'flex';
  document.getElementById('modal-title').textContent = item.title || item.name;
  document.getElementById('modal-description').textContent = item.overview;
  document.getElementById('modal-image').src = `${IMG_URL}${item.poster_path}`;
  document.getElementById('modal-rating').innerHTML = '★'.repeat(Math.round(item.vote_average / 2));

  // Set media type
  currentItem.media_type = currentItem.media_type || (currentItem.first_air_date ? 'tv' : 'movie');

  // Populate server buttons
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
      const response = await fetch(url, { method: 'HEAD', mode: 'no-cors' });
      if (response.ok || response.type === 'opaque') {
        changeServer(serverId);
        // Highlight the selected server button
        const buttons = document.querySelectorAll('.server-btn');
        buttons.forEach(btn => btn.classList.remove('active'));
        const activeButton = Array.from(buttons).find(btn => {
          if (serverId.startsWith('server')) {
            return btn.textContent.trim() === `Server ${serverId.replace('server', '')}`;
          } else if (serverId === 'vidsrc.cc') {
            return btn.textContent.trim() === 'Server 1';
          } else if (serverId === 'vidsrc.me') {
            return btn.textContent.trim() === 'Server 2';
          }
          return false;
        });
        if (activeButton) activeButton.classList.add('active');
        found = true;
        break;
      }
    } catch (e) {
      // Try next
    }
  }
  // If none work, fallback to first
  if (!found) {
    changeServer('vidsrc.cc');
    const buttons = document.querySelectorAll('.server-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    const activeButton = Array.from(buttons).find(btn => btn.textContent.trim() === 'Server 1');
    if (activeButton) activeButton.classList.add('active');
  }
}

    function populateServerButtons() {
      const type = currentItem.media_type || (currentItem.first_air_date ? 'tv' : 'movie');
      const endpoints = type === 'movie' ? MOVIE_ENDPOINTS : TV_ENDPOINTS;
      const container = document.getElementById('server-buttons');
      container.innerHTML = '';
      // Restore Server 2 (vidsrc.me)
      const servers = [
        { name: 'Server 1', id: 'vidsrc.cc' },
        { name: 'Server 2', id: 'vidsrc.me' },
        { name: 'Server 3', id: 'player.videasy.net' },
        ...endpoints.map((_, i) => ({ name: `Server ${i + 4}`, id: `server${i + 4}` }))
      ];
      servers.forEach((server, index) => {
        const button = document.createElement('button');
        button.className = 'server-btn';
        button.textContent = server.name;
        button.onclick = () => changeServer(server.id);
        if (index === 0) button.classList.add('active');
        container.appendChild(button);
      });
    }    function changeServer(server) {
      if (!currentItem) return;

      // Update active button state
      const buttons = document.querySelectorAll('.server-btn');
      buttons.forEach(btn => btn.classList.remove('active'));
      const activeButton = Array.from(buttons).find(btn => {
        if (server === 'vidsrc.cc') return btn.textContent.trim() === 'Server 1';
        if (server === 'vidsrc.me') return btn.textContent.trim() === 'Server 2';
        if (server === 'player.videasy.net') return btn.textContent.trim() === 'Server 3';
        return btn.textContent.trim() === `Server ${server.replace('server', '')}`;
      });
      if (activeButton) activeButton.classList.add('active');

      const type = currentItem.media_type || (currentItem.first_air_date ? 'tv' : 'movie');
      const embedURL = getServerUrl(server, type, currentItem.id);

      if (!embedURL) {
        console.error("Unsupported server:", server);
        return;
      }

      try {
        const videoFrame = document.getElementById('modal-video');
        
        // Save current source to check if it changes
        const previousSrc = videoFrame.src;
        
        // Update iframe source
        videoFrame.src = embedURL;
        
        // Clear previous error handler
        videoFrame.onerror = null;
        
        // Add load event handler
        videoFrame.onload = () => {
          console.log(`Server ${server} loaded successfully`);
        };
        
        // Add error handler
        videoFrame.onerror = () => {
          console.error(`Failed to load video from ${server}`);
          
          // Only try next server if current attempt actually changed the source
          if (previousSrc !== embedURL) {
            videoFrame.src = ''; // Clear the failed source
            // Try next server automatically
            const currentIndex = parseInt(server.replace('server', ''));
            const nextServer = `server${currentIndex + 1}`;
            const nextUrl = getServerUrl(nextServer, type, currentItem.id);
            if (nextUrl) {
              changeServer(nextServer);
            }
          }
        };
      } catch (error) {
        console.error(`Error changing to server ${server}:`, error);
      }
    }

    function getServerNumber(server) {
      if (typeof server === 'string' && server.startsWith('server')) {
        return parseInt(server.replace('server', ''));
      }
      return 1;
    }

    function closeModal() {
      document.getElementById('modal').style.display = 'none';
      document.getElementById('modal-video').src = '';
    }

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

    async function checkVideoAvailability(item) {
      const type = item.media_type || (item.first_air_date ? 'tv' : 'movie');
      const endpoints = type === 'movie' ? MOVIE_ENDPOINTS : TV_ENDPOINTS;
      
      // Create an array of promises for parallel checking
      const checks = endpoints.map(endpoint => {
        return new Promise(async (resolve) => {
          try {
            let url;
            if (endpoint.includes('gdriveplayer')) {
              url = endpoint + item.id + (type === 'tv' ? '&s=1&e=1' : '');
            } else if (endpoint.includes('playtaku')) {
              url = endpoint + item.id + (type === 'tv' ? '&s=1&ep=1' : '');
            } else {
              url = endpoint + item.id;
            }

            const response = await fetch(url, { 
              method: 'HEAD',
              mode: 'no-cors',
              timeout: 5000 // 5 second timeout
            });
            
            // Consider opaque responses as successful in no-cors mode
            resolve(response.type === 'opaque' || response.ok);
          } catch (error) {
            resolve(false);
          }
        });
      });

      // Check all endpoints in parallel with Promise.race
      try {
        // Wait for the first successful response or all failures
        const results = await Promise.race([
          Promise.any(checks), // First success
          new Promise(resolve => setTimeout(() => resolve(false), 10000)) // 10s timeout
        ]);
        
        return results !== false;
      } catch (error) {
        console.warn(`No available servers found for ${type} ID: ${item.id}`);
        return false;
      }
    }

    async function displayBrowseResults(items) {
      const container = document.getElementById('browse-results');
      container.innerHTML = '';
      
      if (!items.length) {
        container.innerHTML = '<div class="no-results">No results found. Try different filters.</div>';
        return;
      }

      const grid = document.createElement('div');
      grid.className = 'browse-grid';

      // Use Promise.all to handle all async operations properly
      const cardPromises = items
        .filter(item => item.poster_path)
        .map(async item => {
          try {
            const isAvailable = await checkVideoAvailability(item);
            if (!isAvailable) return null;
            
            const card = document.createElement('div');
            card.className = 'browse-card';
            
            const img = document.createElement('img');
            img.src = `${IMG_URL}${item.poster_path}`;
            img.alt = item.title || item.name;
            img.onclick = () => showDetails(item);
            
            const title = document.createElement('div');
            title.className = 'browse-title';
            title.textContent = item.title || item.name;
            
            card.appendChild(img);
            card.appendChild(title);
            return card;
          } catch (error) {
            console.error('Error creating browse card:', error);
            return null;
          }
        });

      // Wait for all cards to be processed
      const cards = await Promise.all(cardPromises);
      
      // Filter out null results and append valid cards
      cards
        .filter(card => card !== null)
        .forEach(card => grid.appendChild(card));

      container.appendChild(grid);
    }

    // Add drag scrolling functionality
    function initDragScroll() {
      const sliders = document.querySelectorAll('.list');
      const LONG_PRESS_THRESHOLD = 200; // milliseconds for long press
      
      sliders.forEach(slider => {
        let isDown = false;
        let startX;
        let scrollLeft;
        let longPressTimer;
        let isDraggable = false;

        slider.addEventListener('mousedown', (e) => {
          startX = e.pageX - slider.offsetLeft;
          scrollLeft = slider.scrollLeft;
          
          // Start long press timer
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
          const walk = (x - startX) * 2; // Scroll speed multiplier
          slider.scrollLeft = scrollLeft - walk;
        });

        // Prevent click events when dragging
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
  
  // Add transition class to body
  document.body.classList.add('theme-transitioning');
  
  // Set new theme
  setTheme(newTheme);
  
  // Remove transition class after transition completes
  setTimeout(() => {
    document.body.classList.remove('theme-transitioning');
  }, 300); // Match this with the CSS transition duration
}

// Initialize theme
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  setTheme(savedTheme);
}

    async function init() {
      initTheme();
      const movies = await fetchTrending('movie');
      const tvShows = await fetchTrending('tv');
      const anime = await fetchTrendingAnime();
      const kdramas = await fetchTrendingKDramas();

      // Get 4 random movies for the banner
      bannerItems = movies
        .sort(() => Math.random() - 0.5)
        .slice(0, 4)
        .filter(movie => movie.backdrop_path);

      displayBanner(bannerItems[0]);
      startBannerSlideshow();
        displayList(movies, 'movies-list');
      displayList(tvShows, 'tvshows-list');
      displayList(anime, 'anime-list');
      displayList(kdramas, 'kdrama-list');
      displayList(kdramas, 'kdramas-list');
      
      // Initialize drag scrolling
      initDragScroll();
    }

    init();

    function getServerUrl(server, type, id) {
      // 1. Main servers
      if (server === 'vidsrc.cc') {
        return `https://vidsrc.cc/v2/embed/${type}/${id}`;
      }
      if (server === 'vidsrc.me') {
        return `https://vidsrc.net/embed/${type}/?tmdb=${id}`;
      }
      if (server === 'player.videasy.net') {
        return `https://player.videasy.net/${type}/${id}`;
      }

      // 2. Other vidsrc servers (io, xyz, dev, etc)
      const endpoints = type === 'movie' ? MOVIE_ENDPOINTS : TV_ENDPOINTS;
      let serverIndex = 0;
      if (typeof server === 'string' && server.startsWith('server')) {
        serverIndex = parseInt(server.replace('server', '')) - 3;
      }
      if (endpoints[serverIndex]) {
        let url = endpoints[serverIndex];
        if (url.includes('vidsrc.') && !url.includes('vidsrc.cc') && !url.includes('vidsrc.me')) {
          return url + id;
        }
      }

      // 3. Vidlink
      if (endpoints[serverIndex] && endpoints[serverIndex].includes('vidlink.pro')) {
        return endpoints[serverIndex] + id;
      }

      // 4. Remaining servers (111movies, 2embed, etc)
      if (endpoints[serverIndex]) {
        let url = endpoints[serverIndex];
        if (url.includes('gdriveplayer')) {
          return url + id + (type === 'tv' ? '&s=1&e=1' : '');
        }
        if (url.includes('playtaku')) {
          return url + id + (type === 'tv' ? '&s=1&ep=1' : '');
        }
        return url + id;
      }
      return null;
    }
