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

// Initialize browse view
function initBrowseView() {
  populateYearFilter();
  fetchFilteredContent();
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
  const yearFilter = document.getElementById('year-filter');
  const currentYear = new Date().getFullYear();
  yearFilter.innerHTML = '<option value="">All Years</option>';
  for (let year = currentYear; year >= currentYear - 100; year--) {
    yearFilter.innerHTML += `<option value="${year}">${year}</option>`;
  }
}
