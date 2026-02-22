// ==========================================
// 0. GLOBAL UI HELPERS (Toasts & Loaders)
// ==========================================
let loaderInterval; // NEW: Keeps track of the timer

function showToast(message, type = 'error') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? '✅' : '⚠️';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Standard single-message loader (kept for backward compatibility)
function showLoader(text = "Processing document...") {
    document.getElementById('loading-text').innerText = text;
    document.getElementById('loading-overlay').classList.remove('hidden');
}

// NEW: Dynamic Multi-Step Loader
function showDynamicLoader(messages, speedMs = 1500) {
    const textElement = document.getElementById('loading-text');
    document.getElementById('loading-overlay').classList.remove('hidden');
    
    let i = 0;
    textElement.innerText = messages[i]; // Show the first message immediately
    
    // Cycle through the rest of the messages
    loaderInterval = setInterval(() => {
        i++;
        if (i < messages.length) {
            textElement.innerText = messages[i];
        } else {
            clearInterval(loaderInterval); // Stop changing text when we reach the last message
        }
    }, speedMs);
}

function hideLoader() {
    clearInterval(loaderInterval); // NEW: Stop the timer if it is running!
    document.getElementById('loading-overlay').classList.add('hidden');
}

// Override default window.alert to use our new Toast system!
window.alert = function(message) {
    showToast(message, 'error');
};

// ==========================================
// 0.5 TRUE DRAG & DROP + FILE PREVIEWS
// ==========================================

// NEW: Helper to check if the file is valid before processing
function validateFile(file, expectedType = 'application/pdf', maxSizeMB = 50) {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    // 1. Check File Type
    if (expectedType === 'application/pdf' && file.type !== 'application/pdf') {
        showToast(`Invalid file type! Please upload a PDF.`, "error");
        return false;
    }
    
    if (expectedType === 'image' && !file.type.startsWith('image/')) {
        showToast(`Invalid file type! Please upload an image (JPG/PNG).`, "error");
        return false;
    }

    // 2. Check File Size
    if (file.size > maxSizeBytes) {
        showToast(`File too large! Maximum size allowed is ${maxSizeMB}MB.`, "error");
        return false;
    }

    return true;
}

const uploadZones = document.querySelectorAll('.upload-zone');

// 1. Prevent the browser from opening dropped files globally
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    document.body.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
    }, false);
});

// 2. Add drag & drop magic to every upload zone on the website
uploadZones.forEach(zone => {
    const fileInput = zone.querySelector('.file-input');
    const isImageTool = zone.closest('.tool-panel').id === 'panel-img2pdf';
    const expected = isImageTool ? 'image' : 'application/pdf';

    // Visual feedback when dragging over the box
    ['dragenter', 'dragover'].forEach(eventName => {
        zone.addEventListener(eventName, () => zone.classList.add('dragover'), false);
    });

    // Remove visual feedback when dragging away
    ['dragleave', 'drop'].forEach(eventName => {
        zone.addEventListener(eventName, () => zone.classList.remove('dragover'), false);
    });

    // Handle the actual file drop
    zone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length) {
            // Validate EVERY file dropped, not just the first one
            const filesArray = Array.from(files);
            const isValid = filesArray.every(file => validateFile(file, expected));
            
            if (isValid) {
                fileInput.files = files; // Assign the dropped files to the HTML input
                fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    }, false);

    // 3. Create Visual Preview Badges for multiple files
    fileInput.addEventListener('change', function() {
        // Clear any old badges from the screen so they don't duplicate
        zone.querySelectorAll('.file-preview-badge').forEach(b => b.remove());

        if (this.files && this.files.length > 0) {
            const filesArray = Array.from(this.files);
            
            // Check all files to make sure they are valid (PDFs, right size, etc.)
            const isValid = filesArray.every(file => validateFile(file, expected));
            if (!isValid) {
                this.value = ''; // Empty invalid files
                return;          
            }

            // Loop through EVERY file and create a badge for it
            filesArray.forEach(file => {
                const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2); 
                
                const badge = document.createElement('div');
                badge.className = 'file-preview-badge';
                badge.innerHTML = `
                    <div class="file-info">
                        <span>📄</span>
                        <span>${file.name} (${fileSizeMB} MB)</span>
                    </div>
                    <button type="button" class="remove-file-btn" title="Remove this file">✖</button>
                `;

                // Make the 'X' button work so they can remove ONLY this specific file
                badge.querySelector('.remove-file-btn').addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // 1. Create a new, empty virtual file list
                    const dt = new DataTransfer();
                    
                    // 2. Loop through the current files in the input
                    for (let i = 0; i < fileInput.files.length; i++) {
                        const currentFile = fileInput.files[i];
                        // 3. Keep every file EXCEPT the one attached to this specific badge
                        if (currentFile !== file) {
                            dt.items.add(currentFile);
                        }
                    }
                    
                    // 4. Overwrite the input with our new list
                    fileInput.files = dt.files;
                    
                    // 5. Remove only this specific badge from the screen
                    badge.remove();
                });

                zone.appendChild(badge);
            });
        }
    });
});

// ==========================================
// 0.6 DARK MODE TOGGLE LOGIC
// ==========================================
const themeToggle = document.getElementById('theme-toggle');
const body = document.body;

// 1. Check if the user previously saved a Dark Mode preference
const savedTheme = localStorage.getItem('pdf-studio-theme');
if (savedTheme === 'dark') {
    body.classList.add('dark-mode');
    themeToggle.innerText = '☀️';
}

// 2. Listen for clicks on the toggle button
themeToggle.addEventListener('click', () => {
    // Flip the dark mode class on or off
    body.classList.toggle('dark-mode');
    
    // Check if it is currently active
    const isDarkMode = body.classList.contains('dark-mode');
    
    // Swap the icon
    themeToggle.innerText = isDarkMode ? '☀️' : '🌙';
    
    // Save their preference to the browser memory!
    localStorage.setItem('pdf-studio-theme', isDarkMode ? 'dark' : 'light');
});

// ==========================================
// 1. UI, FILTERING & ROUTING LOGIC
// ==========================================
const gridView = document.getElementById('grid-view');
const workspaceView = document.getElementById('workspace-view');
const toolCards = document.querySelectorAll('.tool-card');
const toolPanels = document.querySelectorAll('.tool-panel');

// Breadcrumb Elements
const breadcrumb = document.getElementById('breadcrumb');
const bcHome = document.getElementById('bc-home');
const bcCategory = document.getElementById('bc-category');
const bcTool = document.getElementById('bc-tool');

// Filter Pills Elements
const filterBtns = document.querySelectorAll('.filter-btn');

// --- Category Filtering Logic ---
filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove active class from all buttons, add to clicked
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const filterValue = btn.getAttribute('data-filter');

        // Hide/Show cards based on category
        toolCards.forEach(card => {
            if (filterValue === 'all' || card.getAttribute('data-category') === filterValue) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        });
    });
});

// --- Live Search Filtering Logic ---
const searchInput = document.getElementById('tool-search');

searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    
    // 1. Reset the category pills to "All" when searching
    filterBtns.forEach(b => b.classList.remove('active'));
    document.querySelector('[data-filter="all"]').classList.add('active');

    // 2. Loop through every card and check if the title or description matches
    toolCards.forEach(card => {
        const title = card.querySelector('h3').innerText.toLowerCase();
        const desc = card.querySelector('p').innerText.toLowerCase();
        
        if (title.includes(searchTerm) || desc.includes(searchTerm)) {
            card.style.display = 'flex'; // Show it
        } else {
            card.style.display = 'none'; // Hide it
        }
    });
});

// --- Routing: Click a card to open the tool ---
toolCards.forEach(card => {
    card.addEventListener('click', () => {
        const targetId = card.getAttribute('data-target');
        const toolName = card.querySelector('h3').innerText;
        const categoryName = card.getAttribute('data-category');
        
        // Hide grid, show workspace
        gridView.classList.add('hidden');
        workspaceView.classList.remove('hidden');

        // NEW: Instantly scroll back to the very top of the page!
        window.scrollTo(0, 0);
        
        // Setup Breadcrumbs
        breadcrumb.classList.remove('hidden');
        bcCategory.innerText = categoryName.charAt(0).toUpperCase() + categoryName.slice(1);
        bcTool.innerText = toolName;

        // Hide all panels, show the targeted one
        toolPanels.forEach(p => p.classList.remove('active'));
        document.getElementById(targetId).classList.add('active');
    });
});

// --- Routing: Click breadcrumb 'Home' to return to grid ---
function returnHome() {
    workspaceView.classList.add('hidden');
    gridView.classList.remove('hidden');
    breadcrumb.classList.add('hidden');

    // NEW: Scroll back to the top when returning to the home screen!
    window.scrollTo(0, 0);
}

bcHome.addEventListener('click', returnHome);
document.getElementById('back-btn').addEventListener('click', returnHome);
document.querySelector('.logo').addEventListener('click', returnHome);
document.querySelector('.logo').style.cursor = 'pointer'; // Make logo clickable too!


// ==========================================
// 2. CORE PDF LOGIC
// ==========================================

// --- MERGE (Upgraded for Unlimited Files) ---
document.getElementById('merge-btn').addEventListener('click', async () => {
    const fileInput = document.getElementById('pdf-merge-input');
    const files = fileInput.files;
    
    if (files.length < 2) {
        return showToast("Please upload at least two PDFs to merge!", "error");
    }

    showLoader("Merging PDFs... This might take a moment.");

    try {
        const mergedPdf = await PDFLib.PDFDocument.create();

        // Loop through EVERY file uploaded
        for (let i = 0; i < files.length; i++) {
            const fileBytes = await files[i].arrayBuffer();
            const pdfToMerge = await PDFLib.PDFDocument.load(fileBytes);
            
            // Copy all pages from this file into the master document
            const copiedPages = await mergedPdf.copyPages(pdfToMerge, pdfToMerge.getPageIndices());
            copiedPages.forEach(page => mergedPdf.addPage(page));
        }

        triggerDownload(await mergedPdf.save(), 'Merged_Document.pdf');
        
        // Reset UI upon success
        fileInput.value = '';
        fileInput.closest('.upload-zone').querySelectorAll('.file-preview-badge').forEach(b => b.remove());
        showToast("PDFs merged successfully!", "success");
        
    } catch (error) {
        showToast("Error merging files: " + error.message, "error");
    } finally {
        hideLoader(); // Always turn off the spinner, even if it fails
    }
});

// --- EXTRACT (Upgraded for Ranges!) ---
document.getElementById('split-btn').addEventListener('click', async () => {
    const fileInput = document.getElementById('pdf-split-input').files[0];
    const rangeInput = document.getElementById('page-to-extract').value;
    if (!fileInput || !rangeInput) return alert("Upload a file and enter a page/range!");

    const originalPdf = await PDFLib.PDFDocument.load(await fileInput.arrayBuffer());
    const totalPages = originalPdf.getPageCount();
    const newPdf = await PDFLib.PDFDocument.create();
    
    // Parse the input (e.g., "3" or "2-5")
    let pagesToExtract = [];
    if (rangeInput.includes('-')) {
        const parts = rangeInput.split('-');
        let start = parseInt(parts[0]) - 1;
        let end = parseInt(parts[1]) - 1;
        if (start < 0 || end >= totalPages || start > end) return alert("Invalid range!");
        for (let i = start; i <= end; i++) pagesToExtract.push(i);
    } else {
        const target = parseInt(rangeInput) - 1;
        if (target < 0 || target >= totalPages) return alert("Invalid page number!");
        pagesToExtract.push(target);
    }

    const copiedPages = await newPdf.copyPages(originalPdf, pagesToExtract);
    copiedPages.forEach(page => newPdf.addPage(page));

    triggerDownload(await newPdf.save(), 'Extracted_Pages.pdf');
});

// --- DELETE ---
document.getElementById('delete-btn').addEventListener('click', async () => {
    const fileInput = document.getElementById('pdf-delete-input').files[0];
    const pageNum = parseInt(document.getElementById('page-to-delete').value) - 1;
    if (!fileInput || isNaN(pageNum)) return alert("Upload file and enter page!");

    const pdfDoc = await PDFLib.PDFDocument.load(await fileInput.arrayBuffer());
    if (pageNum < 0 || pageNum >= pdfDoc.getPageCount()) return alert("Invalid page!");

    pdfDoc.removePage(pageNum);
    triggerDownload(await pdfDoc.save(), 'Cleaned_Document.pdf');
});

// --- ROTATE ---
document.getElementById('rotate-btn').addEventListener('click', async () => {
    const fileInput = document.getElementById('pdf-rotate-input').files[0];
    const deg = parseInt(document.getElementById('rotate-degrees').value);
    if (!fileInput) return alert("Upload a PDF!");

    const pdfDoc = await PDFLib.PDFDocument.load(await fileInput.arrayBuffer());
    pdfDoc.getPages().forEach(page => {
        page.setRotation(PDFLib.degrees(page.getRotation().angle + deg));
    });

    triggerDownload(await pdfDoc.save(), 'Rotated_Document.pdf');
});

// --- WATERMARK ---
document.getElementById('watermark-btn').addEventListener('click', async () => {
    const fileInput = document.getElementById('pdf-watermark-input').files[0];
    const text = document.getElementById('watermark-text').value;
    if (!fileInput || !text) return alert("Upload file and enter text!");

    const pdfDoc = await PDFLib.PDFDocument.load(await fileInput.arrayBuffer());
    const font = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    
    pdfDoc.getPages().forEach(page => {
        const { width, height } = page.getSize();
        page.drawText(text, {
            x: width / 2 - (text.length * 12),
            y: height / 2,
            size: 50, font: font, color: PDFLib.rgb(0.85, 0.2, 0.2), opacity: 0.3, rotate: PDFLib.degrees(-45),
        });
    });

    triggerDownload(await pdfDoc.save(), 'Watermarked_Document.pdf');
});

// --- IMAGE TO PDF ---
document.getElementById('img-to-pdf-btn').addEventListener('click', async () => {
    const fileInput = document.getElementById('image-input').files[0];
    if (!fileInput) return alert("Upload an image!");

    const pdfDoc = await PDFLib.PDFDocument.create();
    const imageBytes = await fileInput.arrayBuffer();
    
    let img;
    if (fileInput.type === 'image/jpeg' || fileInput.type === 'image/jpg') img = await pdfDoc.embedJpg(imageBytes);
    else if (fileInput.type === 'image/png') img = await pdfDoc.embedPng(imageBytes);
    else return alert("Only JPG/PNG supported!");

    const { width, height } = img.scale(1);
    const page = pdfDoc.addPage([width, height]);
    page.drawImage(img, { x: 0, y: 0, width, height });

    triggerDownload(await pdfDoc.save(), 'Converted_Image.pdf');
});

// --- PAGE NUMBERS ---
document.getElementById('pagenum-btn').addEventListener('click', async () => {
    const fileInput = document.getElementById('pdf-pagenum-input').files[0];
    if (!fileInput) return alert("Upload a PDF!");

    const pdfDoc = await PDFLib.PDFDocument.load(await fileInput.arrayBuffer());
    const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();

    pages.forEach((page, index) => {
        const text = `Page ${index + 1} of ${pages.length}`;
        page.drawText(text, {
            x: (page.getSize().width / 2) - 30, y: 20, size: 12, font: font, color: PDFLib.rgb(0, 0, 0),
        });
    });

    triggerDownload(await pdfDoc.save(), 'Numbered_Document.pdf');
});

// --- METADATA ---
document.getElementById('meta-btn').addEventListener('click', async () => {
    const fileInput = document.getElementById('pdf-meta-input').files[0];
    const title = document.getElementById('meta-title').value;
    const author = document.getElementById('meta-author').value;
    if (!fileInput) return alert("Upload a PDF!");

    const pdfDoc = await PDFLib.PDFDocument.load(await fileInput.arrayBuffer());
    if (title) pdfDoc.setTitle(title);
    if (author) pdfDoc.setAuthor(author);
    
    triggerDownload(await pdfDoc.save(), 'Updated_Metadata.pdf');
});

// --- INSERT BLANK PAGE ---
document.getElementById('insert-btn').addEventListener('click', async () => {
    const fileInput = document.getElementById('pdf-insert-input').files[0];
    const insertAfter = parseInt(document.getElementById('insert-index').value);
    if (!fileInput || isNaN(insertAfter)) return alert("Upload file and enter page number!");

    const pdfDoc = await PDFLib.PDFDocument.load(await fileInput.arrayBuffer());
    const target = insertAfter > pdfDoc.getPageCount() ? pdfDoc.getPageCount() : insertAfter;
    pdfDoc.insertPage(target, [595.28, 841.89]); // A4 Size

    triggerDownload(await pdfDoc.save(), 'Inserted_Page.pdf');
});

// --- HELPER FUNCTION ---
function triggerDownload(byteData, fileName) {
    const blob = new Blob([byteData], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
}

// --- UNLOCK PDF LOGIC (Talking to Python) ---
document.getElementById('unlock-btn').addEventListener('click', async () => {
    const fileInput = document.getElementById('pdf-unlock-input').files[0];
    const password = document.getElementById('unlock-password').value;
    
    if (!fileInput || !password) return alert("Upload a file and enter the password!");

    // 1. Package the file and password together
    const formData = new FormData();
    formData.append('file', fileInput);
    formData.append('password', password);

    try {
        // 2. Send it to our local Python server
        const response = await fetch('http://127.0.0.1:5000/unlock', {
            method: 'POST',
            body: formData
        });

        // 3. Handle errors (like a wrong password)
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText);
        }

        // 4. Receive the unlocked file and download it
        const blob = await response.blob();
        triggerDownload(blob, 'Unlocked_Document.pdf');
        
    } catch (error) {
        alert("Server Error: " + error.message);
    }
});

// --- PROTECT PDF LOGIC (Talking to Python) ---
document.getElementById('protect-btn').addEventListener('click', async () => {
    const fileInput = document.getElementById('pdf-protect-input').files[0];
    const password = document.getElementById('protect-password').value;
    
    if (!fileInput || !password) return alert("Please upload a file and set a password!");

    const formData = new FormData();
    formData.append('file', fileInput);
    formData.append('password', password);

    try {
        const response = await fetch('http://127.0.0.1:5000/protect', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText);
        }

        const blob = await response.blob();
        // Uses your existing triggerDownload helper function
        triggerDownload(blob, 'Protected_Document.pdf');
        
    } catch (error) {
        alert("Server Error: " + error.message);
    }
});

// --- COMPRESS PDF LOGIC (Talking to Python) ---
document.getElementById('compress-btn').addEventListener('click', async () => {
    const fileInput = document.getElementById('pdf-compress-input');
    const file = fileInput.files[0];
    if (!file) return showToast("Please upload a PDF to compress!", "error");

    // Turn on the loading overlay
    showDynamicLoader([
        "Uploading securely...", 
        "Server is processing...", 
        "Optimizing file size...", 
        "Preparing your download..."
    ], 1200); // Changes message every 1.2 seconds

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('http://127.0.0.1:5000/compress', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText);
        }

        // 1. Read the custom headers sent by our Python server!
        const originalSize = parseInt(response.headers.get('X-Original-Size'), 10);
        const compressedSize = parseInt(response.headers.get('X-Compressed-Size'), 10);

        // 2. Download the actual file
        const blob = await response.blob();
        triggerDownload(blob, 'Compressed_Document.pdf');

        // 3. The Analytics Math
        if (originalSize && compressedSize) {
            const savedBytes = originalSize - compressedSize;
            const savedMB = (savedBytes / (1024 * 1024)).toFixed(2);
            const percentSaved = Math.round((savedBytes / originalSize) * 100);

            if (savedBytes > 0) {
                showToast(`🎉 Success! PDF reduced by ${percentSaved}% (Saved ${savedMB} MB).`, "success");
            } else {
                showToast("✅ PDF compressed! (File was already highly optimized).", "success");
            }
        } else {
            showToast("✅ PDF compressed successfully!", "success");
        }

        // 4. Reset the UI
        fileInput.value = '';
        fileInput.closest('.upload-zone').querySelectorAll('.file-preview-badge').forEach(b => b.remove());
        
    } catch (error) {
        showToast("Server Error: " + error.message, "error");
    } finally {
        // Always turn off the loader, even if it fails!
        hideLoader();
    }
});

// --- OCR PDF LOGIC (Talking to Python) ---
document.getElementById('ocr-btn').addEventListener('click', async () => {
    const fileInput = document.getElementById('pdf-ocr-input').files[0];
    if (!fileInput) return showToast("Please upload a scanned PDF!", "error");

    // NEW: Add the dynamic loader! OCR is slow, so we use 2.5 seconds per message
    showDynamicLoader([
        "Uploading scanned document...",
        "Running Optical Character Recognition...",
        "Extracting text data...",
        "Finalizing text file..."
    ], 2500);

    const formData = new FormData();
    formData.append('file', fileInput);

    try {
        const response = await fetch('http://127.0.0.1:5000/ocr', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText);
        }

        const blob = await response.blob();
        // Downloads as a .txt file
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Extracted_Text.txt';
        a.click();
        
        showToast("Text extracted successfully!", "success");
        document.getElementById('pdf-ocr-input').value = ''; // Reset UI
        
    } catch (error) {
        showToast("Server Error: " + error.message, "error");
    } finally {
        hideLoader(); // NEW: Always turn off the loader when finished!
    }
});

// --- PDF TO IMAGE LOGIC (Talking to Python) ---
document.getElementById('pdf2img-btn').addEventListener('click', async () => {
    const fileInput = document.getElementById('pdf-to-img-input').files[0];
    const formatChoice = document.getElementById('img-format').value; // Get the dropdown value
    
    if (!fileInput) return alert("Please upload a PDF!");

    const formData = new FormData();
    formData.append('file', fileInput);
    formData.append('format', formatChoice); // Send format choice to Python

    try {
        const response = await fetch('http://127.0.0.1:5000/pdf-to-img', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText);
        }

        const blob = await response.blob();
        
        // Determine file extension for the downloaded file
        const ext = formatChoice === 'png' ? 'png' : 'jpg';
        const contentType = response.headers.get('content-type');
        
        let fileName = 'Converted_Images.zip';
        if (contentType && contentType.includes('image/')) {
            fileName = `Converted_Image.${ext}`; // Single image
        }

        triggerDownload(blob, fileName);
        
    } catch (error) {
        alert("Server Error: " + error.message);
    }
});

// --- ORGANIZE PDF LOGIC ---
let organizePdfBuffer = null;
let draggedItem = null;

// --- Configure PDF.js Worker ---
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// 1. When a file is uploaded, generate the visual page blocks with THUMBNAILS
document.getElementById('pdf-organize-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const dragContainer = document.getElementById('drag-container');
    
    // Show a loading state (thumbnails take a second to generate)
    dragContainer.innerHTML = '<p style="color: var(--text-muted);">Generating visual thumbnails...</p>';
    document.getElementById('organize-upload-zone').style.display = 'none';
    document.getElementById('organize-workspace').classList.remove('hidden');

    // Load the file into memory
    organizePdfBuffer = await file.arrayBuffer();

    // NEW: We use .slice(0) to give PDF.js a clone of the file!
    const loadingTask = pdfjsLib.getDocument(new Uint8Array(organizePdfBuffer.slice(0)));
    const pdfDocVisual = await loadingTask.promise;
    const pageCount = pdfDocVisual.numPages;

    dragContainer.innerHTML = ''; // Clear the loading text

    // Loop through and take a picture of every page
    for (let i = 1; i <= pageCount; i++) {
        // Grab the page and scale it down so it renders fast
        const page = await pdfDocVisual.getPage(i);
        const viewport = page.getViewport({ scale: 1.0 }); 
        
        // Create an invisible canvas to draw the picture on
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Draw the PDF page onto the canvas
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;
        
        // Convert the canvas into a standard JPG image URL
        const imgUrl = canvas.toDataURL('image/jpeg', 0.8);

        // Build the draggable block
        const pageDiv = document.createElement('div');
        pageDiv.className = 'drag-page';
        pageDiv.draggable = true;
        pageDiv.dataset.pageIndex = i - 1; // Keep the 0-based index for pdf-lib to use later

        // Inject the image and the text label
        pageDiv.innerHTML = `
            <img src="${imgUrl}" alt="Page ${i}">
            <span>Page ${i}</span>
        `;

        // Add native Drag-and-Drop event listeners (Keep your existing drag functions)
        pageDiv.addEventListener('dragstart', handleDragStart);
        pageDiv.addEventListener('dragover', handleDragOver);
        pageDiv.addEventListener('drop', handleDrop);
        pageDiv.addEventListener('dragenter', handleDragEnter);
        pageDiv.addEventListener('dragleave', handleDragLeave);
        pageDiv.addEventListener('dragend', handleDragEnd);

        dragContainer.appendChild(pageDiv);
    }
});

// 2. Drag and Drop Interaction Functions
function handleDragStart(e) {
    draggedItem = this;
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => this.style.opacity = '0.5', 0);
}

function handleDragOver(e) {
    e.preventDefault(); // Required to allow dropping
    return false;
}

function handleDragEnter(e) {
    this.classList.add('drag-over'); // Visual feedback when hovering over another page
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    e.stopPropagation();
    this.classList.remove('drag-over');

    // If dropped on a different page, swap their positions in the HTML
    if (draggedItem !== this) {
        const container = document.getElementById('drag-container');
        const allItems = [...container.querySelectorAll('.drag-page')];
        const draggedIndex = allItems.indexOf(draggedItem);
        const targetIndex = allItems.indexOf(this);

        if (draggedIndex < targetIndex) {
            this.parentNode.insertBefore(draggedItem, this.nextSibling);
        } else {
            this.parentNode.insertBefore(draggedItem, this);
        }
    }
    return false;
}

function handleDragEnd(e) {
    this.style.opacity = '1';
    document.querySelectorAll('.drag-page').forEach(item => {
        item.classList.remove('drag-over');
    });
}

// 3. When "Save New Order" is clicked, build the final PDF
document.getElementById('organize-btn').addEventListener('click', async () => {
    if (!organizePdfBuffer) return;

    // Read the new order visually displayed in the container
    const container = document.getElementById('drag-container');
    const allItems = container.querySelectorAll('.drag-page');
    const newOrder = Array.from(allItems).map(item => parseInt(item.dataset.pageIndex));

    // Open original PDF and create a blank new one
    const originalPdf = await PDFLib.PDFDocument.load(organizePdfBuffer);
    const newPdf = await PDFLib.PDFDocument.create();

    // Copy pages into the exact order the user set
    const copiedPages = await newPdf.copyPages(originalPdf, newOrder);
    copiedPages.forEach(page => newPdf.addPage(page));

    // Download the reordered file
    triggerDownload(await newPdf.save(), 'Organized_Document.pdf');

    // Reset the UI so they can do it again
    document.getElementById('organize-upload-zone').style.display = 'block';
    document.getElementById('organize-workspace').classList.add('hidden');
    document.getElementById('pdf-organize-input').value = '';
    organizePdfBuffer = null;
});

// --- EDIT PDF LOGIC (Interactive Canvas with Multi-Page Support) ---
let editPdfBytes = null;
let editPdfVisualDoc = null;
const canvasScale = 1.5;

// New variables for Multi-page memory
let currentEditPage = 1;
let totalEditPages = 1;
let pageTextData = {}; 

// Helper 1: Render a specific page to the canvas
async function renderEditPage(pageNum) {
    const page = await editPdfVisualDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: canvasScale });

    const canvas = document.getElementById('pdf-edit-canvas');
    const ctx = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: ctx, viewport: viewport }).promise;
    
    const indicator = document.getElementById('edit-page-indicator');
    if (indicator) indicator.innerText = `Page ${pageNum} / ${totalEditPages}`;
}

// Helper 2: Save the text boxes from the screen into JS memory
function saveCurrentPageText() {
    const textElements = document.querySelectorAll('.pdf-text-layer');
    const elementsData = [];
    textElements.forEach(el => {
        if (el.innerText.trim()) {
            elementsData.push({
                text: el.innerText,
                left: el.style.left,
                top: el.style.top
            });
        }
        el.remove(); // Clear from DOM
    });
    pageTextData[currentEditPage] = elementsData;
}

// Helper 3: Put text boxes back on the screen if you return to a page
function restoreCurrentPageText() {
    const canvasWrapper = document.getElementById('pdf-canvas-wrapper');
    if (!canvasWrapper) return;
    
    const elementsData = pageTextData[currentEditPage] || [];
    elementsData.forEach(data => {
        const input = document.createElement('div');
        input.contentEditable = true;
        input.className = 'pdf-text-layer';
        input.style.left = data.left;
        input.style.top = data.top;
        input.innerText = data.text;
        canvasWrapper.appendChild(input);
    });
}

// 1. When a file is uploaded
document.getElementById('pdf-edit-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    document.getElementById('edit-upload-zone').style.display = 'none';
    document.getElementById('edit-workspace').classList.remove('hidden');

    editPdfBytes = await file.arrayBuffer();
    // NEW: We use .slice(0) to give PDF.js a clone of the file!
    const loadingTask = pdfjsLib.getDocument(new Uint8Array(editPdfBytes.slice(0)));
    editPdfVisualDoc = await loadingTask.promise;

    // Reset multi-page variables
    totalEditPages = editPdfVisualDoc.numPages;
    currentEditPage = 1;
    pageTextData = {};
    document.querySelectorAll('.pdf-text-layer').forEach(el => el.remove());

    await renderEditPage(currentEditPage);
});

// 2. Pagination Button Clicks
document.getElementById('prev-edit-page')?.addEventListener('click', async () => {
    if (currentEditPage <= 1) return;
    saveCurrentPageText(); 
    currentEditPage--;
    await renderEditPage(currentEditPage); 
    restoreCurrentPageText(); 
});

document.getElementById('next-edit-page')?.addEventListener('click', async () => {
    if (currentEditPage >= totalEditPages) return;
    saveCurrentPageText(); 
    currentEditPage++;
    await renderEditPage(currentEditPage); 
    restoreCurrentPageText(); 
});

// 3. Spawn a text input when clicking the canvas
const canvasWrapper = document.getElementById('pdf-canvas-wrapper');
canvasWrapper?.addEventListener('click', (e) => {
    if(e.target.classList.contains('pdf-text-layer')) return;

    const rect = canvasWrapper.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const input = document.createElement('div');
    input.contentEditable = true;
    input.className = 'pdf-text-layer';
    input.style.left = `${x}px`;
    input.style.top = `${y}px`;

    canvasWrapper.appendChild(input);
    input.focus();
});

// 4. Save the PDF and "burn" the text into ALL pages
document.getElementById('save-edit-btn')?.addEventListener('click', async () => {
    if (!editPdfBytes) return;

    // Save the very last page the user was looking at before they clicked save
    saveCurrentPageText();

    const pdfDoc = await PDFLib.PDFDocument.load(editPdfBytes);
    const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);

    // Loop through every page in our memory that has text modifications
    for (const [pageNumStr, elements] of Object.entries(pageTextData)) {
        const pageNum = parseInt(pageNumStr);
        const page = pdfDoc.getPage(pageNum - 1); // pdf-lib pages start at 0
        const { height: pageHeight } = page.getSize();

        elements.forEach(data => {
            const left = parseInt(data.left, 10);
            const top = parseInt(data.top, 10);

            const pdfFontSize = 14;
            const pdfX = left / canvasScale;
            const pdfY = pageHeight - ((top + 18) / canvasScale);

            page.drawText(data.text, {
                x: pdfX,
                y: pdfY,
                size: pdfFontSize,
                font: font,
                color: PDFLib.rgb(0, 0, 0)
            });
        });
    }

    triggerDownload(await pdfDoc.save(), 'Edited_Document.pdf');

    // Reset the UI completely
    document.getElementById('edit-upload-zone').style.display = 'block';
    document.getElementById('edit-workspace').classList.add('hidden');
    document.getElementById('pdf-edit-input').value = '';
    document.querySelectorAll('.pdf-text-layer').forEach(el => el.remove());
    pageTextData = {};
    editPdfBytes = null;
});

// --- PDF TO WORD LOGIC (Talking to Python) ---
document.getElementById('pdf2word-btn')?.addEventListener('click', async () => {
    const fileInput = document.getElementById('pdf-word-input');
    const file = fileInput.files[0];
    if (!file) return showToast("Please upload a PDF!", "error");

    showDynamicLoader([
        "Uploading PDF securely...",
        "Analyzing document structure...",
        "Rebuilding text and tables...",
        "Preparing Word document..."
    ], 1500);

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('http://127.0.0.1:5000/pdf-to-word', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText);
        }

        // Download the Word file
        const blob = await response.blob();
        triggerDownload(blob, 'Converted_Document.docx');
        
        showToast("Converted to Word successfully!", "success");
        
        // Clean up UI
        fileInput.value = '';
        fileInput.closest('.upload-zone').querySelectorAll('.file-preview-badge').forEach(b => b.remove());
        
    } catch (error) {
        showToast("Server Error: " + error.message, "error");
    } finally {
        hideLoader();
    }
});

// ==========================================
// 3. KEYBOARD SHORTCUTS (Power-User UX)
// ==========================================
document.addEventListener('keydown', (e) => {
    
    // --- ESCAPE KEY: Go Back / Return Home ---
    if (e.key === 'Escape') {
        // Only trigger if we are actually inside a tool (workspace is not hidden)
        const workspaceView = document.getElementById('workspace-view');
        if (!workspaceView.classList.contains('hidden')) {
            returnHome(); // Your existing function that safely returns to the grid
        }
    }
    
    // --- CTRL + D (or CMD + D): Toggle Dark Mode ---
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault(); // IMPORTANT: Stops the browser's default "Bookmark Page" popup!
        document.getElementById('theme-toggle').click(); // Clicks your dark mode button for you
    }
});