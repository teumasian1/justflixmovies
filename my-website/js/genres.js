// Genre categories
const genres = [
    { id: 28, name: "Action" },
    { id: 12, name: "Adventure" },
    { id: 16, name: "Animation" },
    { id: 35, name: "Comedy" },
    { id: 80, name: "Crime" },
    { id: 99, name: "Documentary" },
    { id: 18, name: "Drama" },
    { id: 10751, name: "Family" },
    { id: 14, name: "Fantasy" },
    { id: 36, name: "History" },
    { id: 27, name: "Horror" },
    { id: 10402, name: "Music" },
    { id: 9648, name: "Mystery" },
    { id: 10749, name: "Romance" },
    { id: 878, name: "Science Fiction" },
    { id: 53, name: "Thriller" }
];

async function fetchByGenre(genreId, type = 'movie') {
    const res = await fetch(`${BASE_URL}/discover/${type}?api_key=${API_KEY}&with_genres=${genreId}`);
    const data = await res.json();
    return data.results;
}

function toggleGenreMenu() {
    const menu = document.getElementById('genre-menu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

async function filterByGenre(genreId, type) {
    const results = await fetchByGenre(genreId, type);
    displayList(results, 'movies-list');
    // Scroll to results
    document.getElementById('movies-list').scrollIntoView({ behavior: 'smooth' });
}
