// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';

// DOM elements
const pdfUpload = document.getElementById('pdf-upload');
const uploadBox = document.getElementById('upload-box');
const readBtn = document.getElementById('read-btn');
const pauseBtn = document.getElementById('pause-btn');
const stopBtn = document.getElementById('stop-btn');
const speedSelect = document.getElementById('speed');
const voiceSelect = document.getElementById('voice');
const progressFill = document.getElementById('progress-fill');
const progressPercent = document.getElementById('progress-percent');
const currentPageEl = document.getElementById('current-page');
const pageDisplay = document.getElementById('page-display');
const statusEl = document.getElementById('status');
const pdfRender = document.getElementById('pdf-render');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const themeToggle = document.getElementById('theme-toggle');

// Speech synthesis variables
let speechSynthesis = window.speechSynthesis;
let utterance = null;
let pdfText = '';
let currentPage = 1;
let totalPages = 0;
let pdfDoc = null;
let isReading = false;
let isPaused = false;

// Theme management
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    // Update toggle icon
    const icon = themeToggle.querySelector('i');
    icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

// Initialize theme
const savedTheme = localStorage.getItem('theme') || 'light';
setTheme(savedTheme);

themeToggle.addEventListener('click', toggleTheme);

// Load available voices when they become available
speechSynthesis.onvoiceschanged = function() {
    loadVoices();
};

function loadVoices() {
    const voices = speechSynthesis.getVoices();
    voiceSelect.innerHTML = '';
    
    // Filter for English voices (you can adjust this)
    const englishVoices = voices.filter(voice => voice.lang.includes('en'));
    
    englishVoices.forEach(voice => {
        const option = document.createElement('option');
        option.textContent = `${voice.name} (${voice.lang})`;
        option.setAttribute('data-voice-index', voices.indexOf(voice));
        voiceSelect.appendChild(option);
    });
    
    voiceSelect.disabled = englishVoices.length === 0;
}

// Handle PDF file upload
pdfUpload.addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    updateStatus('Loading PDF...', 'info');
    uploadBox.classList.add('pulse');
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        pdfDoc = await pdfjsLib.getDocument(arrayBuffer).promise;
        totalPages = pdfDoc.numPages;
        
        // Update page display
        updatePageDisplay();
        prevPageBtn.disabled = false;
        nextPageBtn.disabled = totalPages > 1;
        
        // Render the first page
        await renderPage(currentPage);
        
        // Extract text from all pages
        pdfText = await extractTextFromPDF(pdfDoc);
        
        updateStatus(`PDF loaded (${totalPages} pages). Click "Read" to start.`, 'success');
        readBtn.disabled = false;
        uploadBox.classList.remove('pulse');
    } catch (error) {
        updateStatus('Error loading PDF: ' + error.message, 'error');
        console.error(error);
        uploadBox.classList.remove('pulse');
    }
});

// Update status with icon and color
function updateStatus(message, type = 'info') {
    const icon = statusEl.querySelector('i');
    const text = statusEl.querySelector('span');
    
    text.textContent = message;
    
    // Remove all color classes
    icon.className = 'fas';
    statusEl.className = 'status';
    
    switch (type) {
        case 'info':
            icon.classList.add('fa-info-circle');
            statusEl.classList.add('info');
            break;
        case 'success':
            icon.classList.add('fa-check-circle');
            statusEl.classList.add('success');
            break;
        case 'error':
            icon.classList.add('fa-exclamation-circle');
            statusEl.classList.add('error');
            break;
        case 'warning':
            icon.classList.add('fa-exclamation-triangle');
            statusEl.classList.add('warning');
            break;
    }
}

// Render a PDF page
async function renderPage(pageNum) {
    if (!pdfDoc) return;
    
    try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 });
        
        // Prepare canvas
        const canvas = pdfRender;
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        // Render PDF page into canvas context
        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;
        
        // Update current page display
        currentPage = pageNum;
        updatePageDisplay();
        prevPageBtn.disabled = currentPage <= 1;
        nextPageBtn.disabled = currentPage >= totalPages;
    } catch (error) {
        console.error('Error rendering page:', error);
        updateStatus('Error displaying page', 'error');
    }
}

// Update page display
function updatePageDisplay() {
    pageDisplay.textContent = `${currentPage}/${totalPages}`;
    currentPageEl.textContent = `Page: ${currentPage}/${totalPages}`;
}

// Extract text from all pages of the PDF
async function extractTextFromPDF(pdfDoc) {
    let fullText = '';
    
    for (let i = 1; i <= pdfDoc.numPages; i++) {
        try {
            const page = await pdfDoc.getPage(i);
            const textContent = await page.getTextContent();
            const text = textContent.items.map(item => item.str).join(' ');
            fullText += text + '\n\n';
            
            // Update progress
            const progress = (i / pdfDoc.numPages) * 100;
            progressFill.style.width = `${progress}%`;
            progressPercent.textContent = `${Math.round(progress)}%`;
        } catch (error) {
            console.error(`Error extracting text from page ${i}:`, error);
        }
    }
    
    return fullText;
}

// Start reading the PDF text
readBtn.addEventListener('click', function() {
    if (!pdfText || isReading) return;
    
    isReading = true;
    isPaused = false;
    pauseBtn.disabled = false;
    stopBtn.disabled = false;
    readBtn.disabled = true;
    
    const voices = speechSynthesis.getVoices();
    const selectedVoiceIndex = voiceSelect.selectedOptions[0]?.getAttribute('data-voice-index');
    const selectedVoice = selectedVoiceIndex ? voices[selectedVoiceIndex] : null;
    const speed = parseFloat(speedSelect.value);
    
    utterance = new SpeechSynthesisUtterance(pdfText);
    if (selectedVoice) {
        utterance.voice = selectedVoice;
    }
    utterance.rate = speed;
    
    utterance.onboundary = function(event) {
        // You could add highlighting of the current word here
    };
    
    utterance.onend = function() {
        isReading = false;
        pauseBtn.disabled = true;
        stopBtn.disabled = true;
        readBtn.disabled = false;
        pauseBtn.innerHTML = '<i class="fas fa-pause"></i><span>Pause</span>';
        updateStatus('Reading completed.', 'success');
    };
    
    speechSynthesis.speak(utterance);
    updateStatus('Reading...', 'info');
});

// Pause/resume reading
pauseBtn.addEventListener('click', function() {
    if (!isReading) return;
    
    if (isPaused) {
        speechSynthesis.resume();
        isPaused = false;
        pauseBtn.innerHTML = '<i class="fas fa-pause"></i><span>Pause</span>';
        updateStatus('Reading...', 'info');
    } else {
        speechSynthesis.pause();
        isPaused = true;
        pauseBtn.innerHTML = '<i class="fas fa-play"></i><span>Resume</span>';
        updateStatus('Paused.', 'warning');
    }
});

// Stop reading
stopBtn.addEventListener('click', function() {
    if (!isReading) return;
    
    speechSynthesis.cancel();
    isReading = false;
    isPaused = false;
    pauseBtn.disabled = true;
    stopBtn.disabled = true;
    readBtn.disabled = false;
    pauseBtn.innerHTML = '<i class="fas fa-pause"></i><span>Pause</span>';
    updateStatus('Reading stopped.', 'info');
});

// Change reading speed
speedSelect.addEventListener('change', function() {
    if (utterance && isReading) {
        utterance.rate = parseFloat(this.value);
        speechSynthesis.cancel();
        speechSynthesis.speak(utterance);
    }
});

// Page navigation
prevPageBtn.addEventListener('click', function() {
    if (currentPage > 1) {
        renderPage(currentPage - 1);
    }
});

nextPageBtn.addEventListener('click', function() {
    if (currentPage < totalPages) {
        renderPage(currentPage + 1);
    }
});

// Drag and drop for upload box
uploadBox.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadBox.classList.add('drag-over');
});

uploadBox.addEventListener('dragleave', () => {
    uploadBox.classList.remove('drag-over');
});

uploadBox.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadBox.classList.remove('drag-over');
    
    if (e.dataTransfer.files.length) {
        pdfUpload.files = e.dataTransfer.files;
        const event = new Event('change');
        pdfUpload.dispatchEvent(event);
    }
});

// Initial voice load (in case voices are already loaded)
loadVoices();

// Add status color styles
const style = document.createElement('style');
style.textContent = `
    .status.info { color: var(--text-light); }
    .status.success { color: #2ecc71; }
    .status.error { color: #e74c3c; }
    .status.warning { color: #f39c12; }
`;
document.head.appendChild(style);
