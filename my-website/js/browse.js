import {
  API_KEY,
  BASE_URL,
  IMG_URL,
  createStarRating,
  showDetails
} from './videoModal.js';

// State management
let currentPage = 1;
const itemsPerPage = 36;
let totalPages = 0;
let currentFilters = {
  type: 'movie',
  genre: '',
  year: '',
  country: '',
  sort: 'popularity.desc'
};

async function fetchFilteredContent() {
  // Show loading spinner
  document.getElementById('loading-spinner').style.display = 'flex';
  document.getElementById('browse-results').style.display = 'none';
  
  try {
    const type = currentFilters.type;
    let url = `${BASE_URL}/discover/${type}?api_key=${API_KEY}&page=${currentPage}`;
    
    if (currentFilters.genre) {
      url += `&with_genres=${currentFilters.genre}`;
    }
    if (currentFilters.year) {
      url += `&year=${currentFilters.year}`;
    }
    if (currentFilters.country) {
      url += `&with_origin_country=${currentFilters.country}`;
    }
    if (currentFilters.sort) {
      url += `&sort_by=${currentFilters.sort}`;
    }

    const response = await fetch(url);
    const data = await response.json();
    totalPages = Math.ceil(data.total_results / itemsPerPage);
    
    // Get exactly 36 items
    const results = data.results.slice(0, itemsPerPage);
    await displayBrowseResults(results);
    updatePagination();
  } catch (error) {
    console.error('Error fetching content:', error);
  } finally {
    // Hide loading spinner
    document.getElementById('loading-spinner').style.display = 'none';
    document.getElementById('browse-results').style.display = 'block';
  }
}

function updateFilter(filterType, value) {
  currentFilters[filterType] = value;
  currentPage = 1; // Reset to first page when filter changes
  fetchFilteredContent();
}

function changePage(direction) {
  if (direction === 'prev' && currentPage > 1) {
    currentPage--;
  } else if (direction === 'next' && currentPage < totalPages) {
    currentPage++;
  }
  fetchFilteredContent();
}

function updatePagination() {
  const pagination = document.getElementById('pagination');
  const pageNumbers = document.getElementById('page-numbers');
  pageNumbers.innerHTML = '';

  // Show current page and total pages
  const pageInfo = document.createElement('span');
  pageInfo.className = 'page-info';
  pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  pageNumbers.appendChild(pageInfo);

  // Update prev/next button states
  document.getElementById('prev-page').disabled = currentPage === 1;
  document.getElementById('next-page').disabled = currentPage === totalPages;
}

// Initialize pagination event listeners
function initializePaginationListeners() {
    document.getElementById('prev-page').addEventListener('click', () => {
        changePage('prev');
    });

    document.getElementById('next-page').addEventListener('click', () => {
        changePage('next');
    });
}

// Initialize filter event listeners
function initializeFilterListeners() {
    const filterIds = {
        'type-filter': 'type',
        'genre-filter': 'genre',
        'year-filter': 'year',
        'country-filter': 'country',
        'sort-filter': 'sort'
    };

    Object.entries(filterIds).forEach(([id, filterType]) => {
        const select = document.getElementById(id);
        if (select) {
            select.addEventListener('change', (e) => {
                updateFilter(filterType, e.target.value);
            });
        }
    });
}

// Initialize browse view
function initBrowseView() {
  populateYearFilter();
  initializePaginationListeners();
  initializeFilterListeners();
  fetchFilteredContent();

  // Ensure browse content is styled like the main content area
  const browseContent = document.getElementById('browse-content');
  browseContent.classList.add('content-area');
}

function toggleBrowseView() {
  const browseContent = document.getElementById('browse-content');
  const mainContent = document.getElementById('main-content');
  const searchResults = document.getElementById('search-results');
  
  if (browseContent.style.display === 'none') {
    browseContent.style.display = 'block';
    mainContent.style.display = 'none';
    searchResults.style.display = 'none';
    initBrowseView();
  } else {
    browseContent.style.display = 'none';
    mainContent.style.display = 'block';
    searchResults.style.display = 'none';
  }
}

// Populate year filter with last 100 years
function populateYearFilter() {
  const yearSelect = document.getElementById('year-filter');
  if (!yearSelect) {
    console.error('Year filter select element not found');
    return;
  }

  const currentYear = new Date().getFullYear();
  
  // Add default "All Years" option
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'All Years';
  yearSelect.appendChild(defaultOption);
  
  for (let year = currentYear; year >= currentYear - 100; year--) {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    yearSelect.appendChild(option);
  }
}

async function displayBrowseResults(items) {
  const container = document.getElementById('browse-results');
  if (!container) {
    console.error('Browse results container not found');
    return;
  }

  // Clear previous results
  container.innerHTML = '';
  // Create grid container div
  const gridContainer = document.createElement('div');
  gridContainer.className = 'browse-grid';
  
  // Create and append each poster card
  items.forEach(item => {
    if (!item.poster_path) return;    const posterContainer = document.createElement('div');
    posterContainer.className = 'poster-container';
    
    const img = document.createElement('img');
    img.loading = 'lazy';
    
    // Add loading state and handlers
    posterContainer.classList.add('loading');
    img.onload = () => {
        posterContainer.classList.add('loaded');
        posterContainer.classList.remove('loading');
    };
    
        // Set up placeholder and image URL    // Set up image loading
    const imageUrl = item.poster_path ? 
        `${IMG_URL}${item.poster_path}` : 
        'placeholder.jpg';
    
    img.src = imageUrl;
    img.alt = item.title || item.name;
    
    img.onload = () => {
        posterContainer.classList.add('loaded');
        posterContainer.classList.remove('loading');
    };
    
    img.onerror = () => {
        posterContainer.classList.remove('loading');
        img.src = 'placeholder.jpg';
    };
    
    const overlay = document.createElement('div');
    overlay.className = 'poster-overlay';
    
    const title = document.createElement('h3');
    title.className = 'poster-title';
    title.textContent = item.title || item.name;

    const starRating = createStarRating(item.vote_average * 10);
    
    const releaseYear = document.createElement('div');
    releaseYear.className = 'poster-year';
    const date = item.release_date || item.first_air_date;
    releaseYear.textContent = date ? new Date(date).getFullYear() : 'N/A';
    
    const description = document.createElement('div');
    description.className = 'poster-description';
    description.textContent = item.overview;
    
    overlay.appendChild(title);
    overlay.appendChild(starRating);
    overlay.appendChild(releaseYear);
    overlay.appendChild(description);
    posterContainer.appendChild(img);
    posterContainer.appendChild(overlay);
    
    posterContainer.onclick = () => {
      showDetails(item);
    };
    
    gridContainer.appendChild(posterContainer);
  });

  // Append grid container to results container
  container.appendChild(gridContainer);
}

// Export necessary functions
export {
  changePage,
  toggleBrowseView,
  updateFilter,
  initBrowseView,
  fetchFilteredContent,
  updatePagination,
  displayBrowseResults
};

// Also expose needed functions to window for event handlers
window.toggleBrowseView = toggleBrowseView;
window.updateFilter = updateFilter;
window.changePage = changePage;
