/* ==========================================================================
   HACK TILL DAWN III - PHOTO FRAME GENERATOR SCRIPT
   Client-Side HTML5 Canvas Engine with Live Interactivity & High-Res PNG Export
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Canvas Elements
  const canvas = document.getElementById('frameCanvas');
  const ctx = canvas.getContext('2d');
  const canvasWrapper = document.getElementById('dropZone');
  
  // UI Controls
  const photoInput = document.getElementById('photoInput');
  const uploadBtn = document.getElementById('uploadBtn');
  const cameraBtn = document.getElementById('cameraBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const submitStoryBtn = document.getElementById('submitStoryBtn');
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const zoomSlider = document.getElementById('zoomSlider');
  const rotateLeftBtn = document.getElementById('rotateLeftBtn');
  const rotateRightBtn = document.getElementById('rotateRightBtn');
  const resetBtn = document.getElementById('resetBtn');
  
  const userNameInput = document.getElementById('userNameInput');
  const userSubInput = document.getElementById('userSubInput');
  const roleChips = document.querySelectorAll('.role-chip');
  
  // Camera Modal DOM
  const cameraModal = document.getElementById('cameraModal');
  const cameraVideo = document.getElementById('cameraVideo');
  const closeCameraBtn = document.getElementById('closeCameraBtn');
  const captureBtn = document.getElementById('captureBtn');
  
  // Toast Notification DOM
  const toastNotification = document.getElementById('toastNotification');
  const toastMessage = document.getElementById('toastMessage');
  
  // State Variables
  let userImg = null;
  let localStream = null;
  let imgState = {
    xOffset: 0,
    yOffset: 0,
    scale: 1.0,
    rotation: 0,
    baseScale: 1.0
  };
  
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let activeRole = 'PARTICIPANT';
  const applyFrameToggle = document.getElementById('applyFrameToggle');
  let applyEventFrame = true;

  // Loaded Asset Objects
  const assets = {
    mbccet: new Image(),
    iic: new Image(),
    helios: new Image(),
    mascot: new Image(),
    loadedCount: 0
  };

  // Asset paths
  assets.mbccet.src = 'assets/mbccet_logo.svg';
  assets.iic.src = 'assets/iic_logo.svg';
  assets.helios.src = 'assets/helios_logo.svg';
  assets.mascot.src = 'assets/tv_mascot.svg';

  // Track loaded assets
  const assetKeys = ['mbccet', 'iic', 'helios', 'mascot'];
  assetKeys.forEach(key => {
    assets[key].onload = () => {
      assets.loadedCount++;
      renderCanvas();
    };
  });

  // Initial render when fonts and assets load
  document.fonts.ready.then(() => {
    renderCanvas();
  });

  // Photo Frame Target Geometry (1200 x 1500 Canvas)
  const frameBox = {
    x: 120,
    y: 430,
    width: 960,
    height: 750,
    borderRadius: 24
  };

  /* ==========================================================================
     IMAGE HANDLING & UPLOAD
     ========================================================================== */

  // File Picker Trigger
  uploadBtn.addEventListener('click', () => photoInput.click());

  photoInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  });

  // Drag & Drop Handlers
  canvasWrapper.addEventListener('dragover', (e) => {
    e.preventDefault();
    canvasWrapper.classList.add('drag-over');
  });

  canvasWrapper.addEventListener('dragleave', () => {
    canvasWrapper.classList.remove('drag-over');
  });

  canvasWrapper.addEventListener('drop', (e) => {
    e.preventDefault();
    canvasWrapper.classList.remove('drag-over');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  function handleFile(file) {
    if (!file.type.match('image.*')) {
      alert('Please upload a valid image file (JPG, PNG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        userImg = img;
        resetTransform();
        renderCanvas();
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  function resetTransform() {
    if (!userImg) return;

    // Calculate aspect ratio cover scale for either frameBox or full canvas
    if (applyEventFrame) {
      const scaleW = frameBox.width / userImg.width;
      const scaleH = frameBox.height / userImg.height;
      imgState.baseScale = Math.max(scaleW, scaleH);
    } else {
      const scaleW = canvas.width / userImg.width;
      const scaleH = canvas.height / userImg.height;
      imgState.baseScale = Math.max(scaleW, scaleH);
    }
    imgState.scale = 1.0;
    imgState.xOffset = 0;
    imgState.yOffset = 0;
    imgState.rotation = 0;

    zoomSlider.value = 1.0;
  }

  /* ==========================================================================
     CANVAS INTERACTIVE PAN, ZOOM, ROTATE
     ========================================================================== */

  // Convert Mouse/Touch Coordinates to Canvas 1200x1500 Scale
  function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  // Pointer Drag Handlers
  canvasWrapper.addEventListener('mousedown', (e) => {
    if (!userImg) return;
    isDragging = true;
    const coords = getCanvasCoords(e);
    startX = coords.x - imgState.xOffset;
    startY = coords.y - imgState.yOffset;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging || !userImg) return;
    const coords = getCanvasCoords(e);
    imgState.xOffset = coords.x - startX;
    imgState.yOffset = coords.y - startY;
    renderCanvas();
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // Touch Drag Handlers
  canvasWrapper.addEventListener('touchstart', (e) => {
    if (!userImg) return;
    if (e.touches.length === 1) {
      isDragging = true;
      const coords = getCanvasCoords(e);
      startX = coords.x - imgState.xOffset;
      startY = coords.y - imgState.yOffset;
    }
  });

  canvasWrapper.addEventListener('touchmove', (e) => {
    if (!isDragging || !userImg) return;
    if (e.touches.length === 1) {
      const coords = getCanvasCoords(e);
      imgState.xOffset = coords.x - startX;
      imgState.yOffset = coords.y - startY;
      renderCanvas();
    }
  });

  canvasWrapper.addEventListener('touchend', () => {
    isDragging = false;
  });

  // Mouse Wheel Zoom
  canvasWrapper.addEventListener('wheel', (e) => {
    if (!userImg) return;
    e.preventDefault();
    
    const zoomFactor = e.deltaY < 0 ? 1.05 : 0.95;
    let newScale = imgState.scale * zoomFactor;
    newScale = Math.min(Math.max(newScale, 0.2), 3.0);
    
    imgState.scale = newScale;
    zoomSlider.value = newScale;
    renderCanvas();
  }, { passive: false });

  // Slider Zoom Control
  zoomSlider.addEventListener('input', (e) => {
    imgState.scale = parseFloat(e.target.value);
    renderCanvas();
  });

  zoomInBtn.addEventListener('click', () => {
    imgState.scale = Math.min(imgState.scale + 0.1, 3.0);
    zoomSlider.value = imgState.scale;
    renderCanvas();
  });

  zoomOutBtn.addEventListener('click', () => {
    imgState.scale = Math.max(imgState.scale - 0.1, 0.2);
    zoomSlider.value = imgState.scale;
    renderCanvas();
  });

  // Rotate Controls
  rotateLeftBtn.addEventListener('click', () => {
    imgState.rotation = (imgState.rotation - 90) % 360;
    renderCanvas();
  });

  rotateRightBtn.addEventListener('click', () => {
    imgState.rotation = (imgState.rotation + 90) % 360;
    renderCanvas();
  });

  // Reset Control
  resetBtn.addEventListener('click', () => {
    resetTransform();
    renderCanvas();
  });

  // Role Chips Selector
  roleChips.forEach(chip => {
    chip.addEventListener('click', () => {
      roleChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeRole = chip.getAttribute('data-role');
      renderCanvas();
    });
  });

  // Personalization Inputs
  userNameInput.addEventListener('input', renderCanvas);
  userSubInput.addEventListener('input', renderCanvas);
  applyFrameToggle.addEventListener('change', (e) => {
    applyEventFrame = e.target.checked;
    
    // Dynamically recalculate baseScale to prevent sudden size jumping
    if (userImg) {
      if (applyEventFrame) {
        const scaleW = frameBox.width / userImg.width;
        const scaleH = frameBox.height / userImg.height;
        imgState.baseScale = Math.max(scaleW, scaleH);
      } else {
        const scaleW = canvas.width / userImg.width;
        const scaleH = canvas.height / userImg.height;
        imgState.baseScale = Math.max(scaleW, scaleH);
      }
    }

    // Update labels dynamically
    const downloadSpan = downloadBtn.querySelector('span');
    if (downloadSpan) {
      downloadSpan.textContent = applyEventFrame ? 'Download Frame' : 'Download Photo';
    }
    const submitSpan = submitStoryBtn.querySelector('span');
    if (submitSpan) {
      submitSpan.textContent = applyEventFrame ? 'Submit to Live Story' : 'Submit Photo to Wall';
    }

    renderCanvas();
  });

  /* ==========================================================================
     MAIN CANVAS RENDERING ENGINE (1200 x 1500)
     ========================================================================== */

  function renderCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (applyEventFrame) {
      // 1. DRAW POSTER BACKGROUND
      drawBackground();

      // 2. DRAW USER PHOTO (CLIPPED BEHIND FRAME WINDOW)
      drawUserPhoto();

      // 3. DRAW FRAME OVERLAY & BRANDING GRAPHICS
      drawFrameOverlay();
    } else {
      // Draw User Photo ONLY (without the outer frame layout, details, or logos)
      drawFullUserPhoto();
    }
  }

  // Draw User Photo full-screen covering 1200x1500 canvas
  function drawFullUserPhoto() {
    ctx.save();
    
    if (userImg) {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      ctx.translate(centerX + imgState.xOffset, centerY + imgState.yOffset);
      ctx.rotate((imgState.rotation * Math.PI) / 180);

      // Cover scale for 1200x1500 canvas
      const scaleW = canvas.width / userImg.width;
      const scaleH = canvas.height / userImg.height;
      const coverScale = Math.max(scaleW, scaleH);

      const drawW = userImg.width * coverScale * imgState.scale;
      const drawH = userImg.height * coverScale * imgState.scale;

      ctx.drawImage(userImg, -drawW / 2, -drawH / 2, drawW, drawH);
    } else {
      // Draw Empty State Placeholder
      ctx.fillStyle = '#0B1116';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Inner Dashed Border
      ctx.strokeStyle = 'rgba(16, 179, 159, 0.4)';
      ctx.lineWidth = 4;
      ctx.setLineDash([12, 12]);
      ctx.strokeRect(50, 50, canvas.width - 100, canvas.height - 100);
      ctx.setLineDash([]);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // Icon Circle
      ctx.fillStyle = 'rgba(16, 179, 159, 0.15)';
      ctx.beginPath();
      ctx.arc(centerX, centerY - 40, 50, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#00E5BE';
      ctx.font = 'bold 36px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('📷', centerX, centerY - 28);

      // Helper Text
      ctx.fillStyle = '#F5F4ED';
      ctx.font = 'bold 32px "Inter", sans-serif';
      ctx.fillText('Click or Drop Photo Here', centerX, centerY + 40);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '500 22px "Inter", sans-serif';
      ctx.fillText('Your photo will cover the full canvas', centerX, centerY + 80);
    }

    ctx.restore();
  }

  // Draw Poster Starry / Cyber Grid Backdrop
  function drawBackground() {
    // Deep dark gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 1500);
    bgGrad.addColorStop(0, '#050708');
    bgGrad.addColorStop(0.5, '#0B0F12');
    bgGrad.addColorStop(1, '#050708');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1200, 1500);

    // Starry dots
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    for (let i = 0; i < 80; i++) {
      const sx = (Math.sin(i * 99) * 0.5 + 0.5) * 1200;
      const sy = (Math.cos(i * 33) * 0.5 + 0.5) * 1500;
      const sr = (i % 3) + 1;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Top Angular White/Off-White Backdrop Banner (Exact Hack Till Dawn Poster Style)
    ctx.fillStyle = '#F5F4ED';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(1200, 0);
    ctx.lineTo(1200, 480);
    ctx.lineTo(0, 360);
    ctx.closePath();
    ctx.fill();

    // Dark teal angular divider strip
    ctx.fillStyle = '#0D9488';
    ctx.beginPath();
    ctx.moveTo(0, 360);
    ctx.lineTo(1200, 480);
    ctx.lineTo(1200, 505);
    ctx.lineTo(0, 385);
    ctx.closePath();
    ctx.fill();
  }

  // Draw User Photo Layer
  function drawUserPhoto() {
    ctx.save();

    // Frame Cutout Clipping Boundary
    ctx.beginPath();
    roundRectPath(ctx, frameBox.x, frameBox.y, frameBox.width, frameBox.height, frameBox.borderRadius);
    ctx.clip();

    if (userImg) {
      // Draw User Image with Transform Matrix
      const centerX = frameBox.x + frameBox.width / 2;
      const centerY = frameBox.y + frameBox.height / 2;

      ctx.translate(centerX + imgState.xOffset, centerY + imgState.yOffset);
      ctx.rotate((imgState.rotation * Math.PI) / 180);

      const drawW = userImg.width * imgState.baseScale * imgState.scale;
      const drawH = userImg.height * imgState.baseScale * imgState.scale;

      ctx.drawImage(userImg, -drawW / 2, -drawH / 2, drawW, drawH);
    } else {
      // Draw Empty State Placeholder
      ctx.fillStyle = '#0B1116';
      ctx.fillRect(frameBox.x, frameBox.y, frameBox.width, frameBox.height);

      // Inner Dashed Border
      ctx.strokeStyle = 'rgba(16, 179, 159, 0.4)';
      ctx.lineWidth = 4;
      ctx.setLineDash([12, 12]);
      ctx.strokeRect(frameBox.x + 30, frameBox.y + 30, frameBox.width - 60, frameBox.height - 60);
      ctx.setLineDash([]);

      // Camera / Upload Placeholder Graphic
      const centerX = frameBox.x + frameBox.width / 2;
      const centerY = frameBox.y + frameBox.height / 2;

      // Icon Circle
      ctx.fillStyle = 'rgba(16, 179, 159, 0.15)';
      ctx.beginPath();
      ctx.arc(centerX, centerY - 40, 50, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#00E5BE';
      ctx.font = 'bold 36px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('📷', centerX, centerY - 28);

      // Helper Text
      ctx.fillStyle = '#F5F4ED';
      ctx.font = 'bold 32px "Inter", sans-serif';
      ctx.fillText('Click or Drop Photo Here', centerX, centerY + 40);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '500 22px "Inter", sans-serif';
      ctx.fillText('Fits automatically into this frame', centerX, centerY + 80);
    }

    ctx.restore();

    // Inner shadow overlay on photo frame for realistic depth
    ctx.save();
    ctx.beginPath();
    roundRectPath(ctx, frameBox.x, frameBox.y, frameBox.width, frameBox.height, frameBox.borderRadius);
    ctx.strokeStyle = '#10B39F';
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.restore();
  }

  // Draw Frame Branding & Overlays
  function drawFrameOverlay() {
    // -------------------------------------------------------------
    // A. TOP BRANDING LOGOS (MBCCET, IIC, HELIOS)
    // -------------------------------------------------------------
    if (assets.mbccet.complete) {
      ctx.drawImage(assets.mbccet, 50, 25, 260, 78);
    }
    if (assets.iic.complete) {
      ctx.drawImage(assets.iic, 680, 25, 220, 75);
    }
    if (assets.helios.complete) {
      ctx.drawImage(assets.helios, 920, 25, 230, 75);
    }

    // -------------------------------------------------------------
    // B. PRESENTS TEXT
    // -------------------------------------------------------------
    ctx.fillStyle = '#050708';
    ctx.font = '900 32px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HELIOS IEDC & IIC MBCCET', 600, 150);

    ctx.fillStyle = '#10B39F';
    ctx.font = '800 20px "Orbitron", sans-serif';
    ctx.letterSpacing = '8px';
    ctx.fillText('P R E S E N T S', 600, 185);

    // -------------------------------------------------------------
    // C. HACK TILL DAWN III PIXEL ART TITLE & TILL BADGE
    // -------------------------------------------------------------
    // Title Shadow
    ctx.fillStyle = '#050708';
    ctx.font = '700 82px "Silkscreen", monospace';
    ctx.fillText('Hack', 604, 274);
    ctx.fillText('Dawn', 604, 364);

    // Main Turquoise Pixel Title
    ctx.fillStyle = '#10B39F';
    ctx.fillText('Hack', 600, 270);
    ctx.fillText('Dawn', 600, 360);

    // Diagonal "Till" Badge
    ctx.save();
    ctx.translate(600, 290);
    ctx.rotate((-8 * Math.PI) / 180);

    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#050708';
    ctx.lineWidth = 6;
    roundRectPath(ctx, -90, -32, 180, 64, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#050708';
    ctx.font = '700 40px "Silkscreen", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Till', 0, 12);
    ctx.restore();

    // -------------------------------------------------------------
    // D. EVENT DETAILS PILL BADGE
    // -------------------------------------------------------------
    const pillY = 385;
    ctx.save();
    ctx.fillStyle = '#0A5C53';
    ctx.strokeStyle = '#00E5BE';
    ctx.lineWidth = 3;
    roundRectPath(ctx, 160, pillY, 880, 60, 30);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 22px "Orbitron", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('📅 AUG 19 & 20  |  🕒 5:00 PM TO 9:00 AM  |  📍 CCF LAB', 600, pillY + 38);
    ctx.restore();

    // -------------------------------------------------------------
    // E. PERSONALIZED PARTICIPANT OVERLAY CARD (Bottom of Photo)
    // -------------------------------------------------------------
    const cardY = 1120;
    ctx.save();
    // Glassmorphic name tag card
    ctx.fillStyle = 'rgba(11, 15, 18, 0.95)';
    ctx.strokeStyle = '#10B39F';
    ctx.lineWidth = 4;
    roundRectPath(ctx, 220, cardY, 760, 150, 20);
    ctx.fill();
    ctx.stroke();

    // User Name
    const rawName = userNameInput.value.trim() || 'YOUR NAME HERE';
    ctx.fillStyle = '#F5F4ED';
    ctx.font = 'bold 38px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(rawName.toUpperCase(), 600, cardY + 52);

    // User Subtitle / College
    const rawSub = userSubInput.value.trim() || 'CSE • MBCCET';
    ctx.fillStyle = '#00E5BE';
    ctx.font = '600 22px "Inter", sans-serif';
    ctx.fillText(rawSub.toUpperCase(), 600, cardY + 90);

    // Role Chip Badge
    ctx.fillStyle = '#10B39F';
    roundRectPath(ctx, 500, cardY + 105, 200, 34, 17);
    ctx.fill();

    ctx.fillStyle = '#050708';
    ctx.font = '900 16px "Orbitron", sans-serif';
    ctx.fillText(activeRole, 600, cardY + 128);
    ctx.restore();

    // -------------------------------------------------------------
    // F. MASCOT & FOOTER BRANDING
    // -------------------------------------------------------------
    // TV Mascot on bottom left
    if (assets.mascot.complete) {
      ctx.drawImage(assets.mascot, 40, 1160, 280, 315);
    }

    // QR Code / Registration Stamp on bottom right
    drawQRStamp(1010, 1310);

    // Footer Slogan & College Name
    ctx.fillStyle = '#94A3B8';
    ctx.font = 'italic 500 20px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('"Level Up Your Skills from Day 1!"', 650, 1370);

    ctx.fillStyle = '#00E5BE';
    ctx.font = '700 20px "Orbitron", sans-serif';
    ctx.letterSpacing = '2px';
    ctx.fillText('MIDNIGHT HACKATHON', 650, 1405);

    ctx.fillStyle = '#F5F4ED';
    ctx.font = '600 18px "Inter", sans-serif';
    ctx.fillText('HELIOS IEDC & IIC • MBCCET', 650, 1440);
  }

  // Draw QR Stamp Graphic
  function drawQRStamp(x, y) {
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#10B39F';
    ctx.lineWidth = 3;
    roundRectPath(ctx, -70, -70, 140, 140, 16);
    ctx.fill();
    ctx.stroke();

    // Stylized QR grid pattern
    ctx.fillStyle = '#050708';
    // Top-left finder
    ctx.fillRect(-55, -55, 35, 35);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-45, -45, 15, 15);
    ctx.fillStyle = '#050708';
    ctx.fillRect(-40, -40, 5, 5);

    // Top-right finder
    ctx.fillRect(20, -55, 35, 35);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(30, -45, 15, 15);
    ctx.fillStyle = '#050708';
    ctx.fillRect(35, -40, 5, 5);

    // Bottom-left finder
    ctx.fillRect(-55, 20, 35, 35);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-45, 30, 15, 15);
    ctx.fillStyle = '#050708';
    ctx.fillRect(-40, 35, 5, 5);

    // Random QR data blocks
    ctx.fillRect(0, -20, 10, 20);
    ctx.fillRect(20, 0, 15, 10);
    ctx.fillRect(10, 25, 25, 25);
    ctx.fillRect(-20, 0, 10, 35);

    ctx.restore();
  }

  // Canvas Path Helper for Rounded Rectangles
  function roundRectPath(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  /* ==========================================================================
     INSTANT PNG DOWNLOAD (1200 x 1500)
     ========================================================================== */

  downloadBtn.addEventListener('click', () => {
    // Render latest state
    renderCanvas();

    // Create download link
    const dataURL = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    
    // Clean filename based on name input
    const cleanName = (userNameInput.value.trim() || 'Participant').replace(/[^a-zA-Z0-9]/g, '_');
    link.download = applyEventFrame 
      ? `HackTillDawn3_${cleanName}_Frame.png` 
      : `HackTillDawn3_${cleanName}_Photo.png`;
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast(applyEventFrame ? "Frame downloaded successfully!" : "Photo downloaded successfully!");
  });

  /* ==========================================================================
     WEBCAM CAMERA OPERATIONS
     ========================================================================== */

  // Start Camera Stream
  cameraBtn.addEventListener('click', async () => {
    try {
      const constraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 960 }
        },
        audio: false
      };
      
      localStream = await navigator.mediaDevices.getUserMedia(constraints);
      cameraVideo.srcObject = localStream;
      
      // Hide scanner/guide if frame is disabled to allow normal photo capturing
      const guide = cameraModal.querySelector('.camera-frame-guide');
      const scanner = cameraModal.querySelector('.camera-scanner-line');
      if (guide) guide.style.display = applyEventFrame ? 'block' : 'none';
      if (scanner) scanner.style.display = applyEventFrame ? 'block' : 'none';
      
      cameraModal.classList.add('active');
    } catch (err) {
      console.error('Camera Access Error:', err);
      showToast("Could not access webcam. Please upload a file instead.", true);
    }
  });

  // Stop Camera helper
  function stopCamera() {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;
    }
    cameraVideo.srcObject = null;
    cameraModal.classList.remove('active');
  }

  // Close Camera buttons
  closeCameraBtn.addEventListener('click', stopCamera);
  cameraModal.addEventListener('click', (e) => {
    if (e.target === cameraModal) {
      stopCamera();
    }
  });

  // Capture Video Frame to Canvas
  captureBtn.addEventListener('click', () => {
    if (!localStream || !cameraVideo.videoWidth) {
      showToast("Camera feed is not ready.", true);
      return;
    }

    // Prepare a temporary offscreen canvas to capture current video frame
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCanvas.width = cameraVideo.videoWidth;
    tempCanvas.height = cameraVideo.videoHeight;
    
    // Draw mirrored video frame (since user expects a mirror layout)
    tempCtx.translate(tempCanvas.width, 0);
    tempCtx.scale(-1, 1);
    tempCtx.drawImage(cameraVideo, 0, 0, tempCanvas.width, tempCanvas.height);
    
    // Load as User Image
    const img = new Image();
    img.onload = () => {
      userImg = img;
      resetTransform();
      renderCanvas();
      showToast("Photo captured successfully!");
    };
    img.src = tempCanvas.toDataURL('image/png');
    
    // Stop webcam
    stopCamera();
  });

  /* ==========================================================================
     SUBMIT TO LIVE STORY (API CALL)
     ========================================================================== */

  submitStoryBtn.addEventListener('click', async () => {
    if (!userImg) {
      showToast("Please upload or capture a photo first.", true);
      return;
    }

    // Render latest adjustments
    renderCanvas();

    // Get finalized base64 representation of canvas
    const dataURL = canvas.toDataURL('image/png');

    // Update UI status to prevent multiple rapid submissions
    submitStoryBtn.disabled = true;
    const origContent = submitStoryBtn.innerHTML;
    submitStoryBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Submitting...`;

    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image: dataURL })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        if (result.status === 'approved') {
          showToast("Posted directly to Live Wall!");
        } else {
          showToast("Submitted! Awaiting admin moderation.");
        }
      } else {
        throw new Error(result.error || 'Server error');
      }
    } catch (err) {
      console.error('Submission error:', err);
      showToast("Failed to submit to Live Wall. Try again.", true);
    } finally {
      submitStoryBtn.disabled = false;
      submitStoryBtn.innerHTML = origContent;
    }
  });

  /* ==========================================================================
     NOTIFICATION TOAST HELPER
     ========================================================================== */

  let toastTimer = null;
  function showToast(message, isError = false) {
    if (toastTimer) clearTimeout(toastTimer);

    toastMessage.textContent = message;
    
    // Handle error style
    if (isError) {
      toastNotification.classList.add('error');
      toastNotification.querySelector('i').className = 'fa-solid fa-circle-exclamation toast-icon';
    } else {
      toastNotification.classList.remove('error');
      toastNotification.querySelector('i').className = 'fa-solid fa-circle-check toast-icon';
    }

    // Slide in
    toastNotification.classList.add('show');

    // Slide out after 3.5s
    toastTimer = setTimeout(() => {
      toastNotification.classList.remove('show');
    }, 3500);
  }

  /* ==========================================================================
     SINGLE PAGE APPLICATION ROUTER & CONSOLIDATED LOGIC
     ========================================================================== */

  // DOM Selectors for SPA elements
  const floatingNavControl = document.getElementById('floatingNavControl');
  const navTriggerBtn = document.getElementById('navTriggerBtn');
  const navMenuItems = document.querySelectorAll('.nav-menu-item');
  const viewPanels = document.querySelectorAll('.view-panel');
  
  // Passcode elements
  const passcodeModal = document.getElementById('passcodeModal');
  const closePasscodeBtn = document.getElementById('closePasscodeBtn');
  const submitPasscodeBtn = document.getElementById('submitPasscodeBtn');
  const adminPasscodeInput = document.getElementById('adminPasscodeInput');
  const passcodeError = document.getElementById('passcodeError');
  
  // Admin panel elements
  const autoApproveToggle = document.getElementById('autoApproveToggle');
  const pendingGrid = document.getElementById('pendingGrid');
  const approvedGrid = document.getElementById('approvedGrid');
  const statPending = document.getElementById('statPending');
  const statApproved = document.getElementById('statApproved');
  const statTotal = document.getElementById('statTotal');
  const pendingCount = document.getElementById('pendingCount');
  const approvedCount = document.getElementById('approvedCount');

  // Live Wall slideshow elements
  const slideContainer = document.getElementById('slideContainer');
  const ambientBg = document.getElementById('ambientBg');
  const liveUrlDisplay = document.getElementById('liveUrlDisplay');

  // State Variables for SPA
  let isAdminAuthenticated = false;
  let adminInterval = null;
  let wallInterval = null;
  let slideTimer = null;
  
  // Slideshow data state
  let wallApprovedImages = [];
  let wallCurrentIdx = -1;
  const wallRotationInterval = 7000;

  // Floating compass navigation toggle click
  navTriggerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    floatingNavControl.classList.toggle('open');
  });

  document.addEventListener('click', () => {
    floatingNavControl.classList.remove('open');
  });

  // Hash Router
  function handleRoute() {
    const hash = window.location.hash || '#generator';
    
    // Remove open states
    floatingNavControl.classList.remove('open');

    // Close camera if active
    if (typeof stopCamera === 'function') stopCamera();

    if (hash === '#admin') {
      if (isAdminAuthenticated) {
        switchView('admin');
      } else {
        // Show passcode prompt
        openPasscodePrompt();
      }
    } else if (hash === '#wall') {
      switchView('wall');
    } else {
      // Default to generator
      switchView('generator');
    }
  }

  window.addEventListener('hashchange', handleRoute);
  
  // Trigger router on load
  handleRoute();

  // Switch Active View Panel helper
  function switchView(viewName) {
    // Deactivate all panels
    viewPanels.forEach(panel => panel.classList.remove('active'));
    navMenuItems.forEach(item => item.classList.remove('active'));

    // Activate selected panel
    const targetPanel = document.getElementById(`view-${viewName}`);
    if (targetPanel) targetPanel.classList.add('active');

    // Highlight menu selection
    const targetMenu = document.querySelector(`.nav-menu-item[data-view="${viewName}"]`);
    if (targetMenu) targetMenu.classList.add('active');

    // Clean up all running intervals to save resources
    stopAdminPolling();
    stopWallCarousel();

    // Boot view specific loops
    if (viewName === 'admin') {
      startAdminPolling();
    } else if (viewName === 'wall') {
      startWallCarousel();
    }
  }

  /* --- Passcode Operations --- */
  function openPasscodePrompt() {
    passcodeModal.classList.add('active');
    adminPasscodeInput.value = '';
    passcodeError.classList.remove('show');
    adminPasscodeInput.focus();
  }

  function closePasscodePrompt() {
    passcodeModal.classList.remove('active');
    // If not authenticated, force hash back to generator
    if (!isAdminAuthenticated) {
      window.location.hash = '#generator';
    }
  }

  closePasscodeBtn.addEventListener('click', closePasscodePrompt);
  
  submitPasscodeBtn.addEventListener('click', verifyAdminPasscode);
  adminPasscodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') verifyAdminPasscode();
  });

  function verifyAdminPasscode() {
    const input = adminPasscodeInput.value.trim();
    // Default moderator passcode
    if (input === 'htd3') {
      isAdminAuthenticated = true;
      passcodeModal.classList.remove('active');
      switchView('admin');
      showToast("Access Unlocked. Moderator session active.");
    } else {
      passcodeError.classList.add('show');
      adminPasscodeInput.value = '';
      adminPasscodeInput.focus();
    }
  }

  /* --- Moderator Admin Panel Code --- */
  let adminState = {
    pendingList: [],
    approvedList: []
  };

  async function fetchConfig() {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      autoApproveToggle.checked = data.autoApprove;
    } catch (err) {
      console.error('Failed to fetch config:', err);
    }
  }

  autoApproveToggle.addEventListener('change', async (e) => {
    const val = e.target.checked;
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoApprove: val })
      });
      const data = await res.json();
      showToast(`Auto-Approve set to ${data.autoApprove ? 'ENABLED' : 'DISABLED'}`);
    } catch (err) {
      console.error('Failed to update config:', err);
      autoApproveToggle.checked = !val;
      showToast('Failed to save settings.', true);
    }
  });

  function formatTime(timestamp) {
    const date = new Date(parseInt(timestamp));
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  async function refreshAdminFeeds() {
    try {
      const [resPending, resApproved] = await Promise.all([
        fetch('/api/pending'),
        fetch('/api/approved')
      ]);
      const pendingData = await resPending.json();
      const approvedData = await resApproved.json();

      adminState.pendingList = pendingData.images;
      adminState.approvedList = approvedData.images;

      // Update metrics
      const pCount = adminState.pendingList.length;
      const aCount = adminState.approvedList.length;
      const total = pCount + aCount;

      statPending.textContent = pCount;
      statApproved.textContent = aCount;
      statTotal.textContent = total;

      pendingCount.textContent = `${pCount} PENDING`;
      approvedCount.textContent = `${aCount} LIVE`;

      renderAdminPending();
      renderAdminApproved();
    } catch (err) {
      console.error('Failed to retrieve feeds:', err);
    }
  }

  function renderAdminPending() {
    if (adminState.pendingList.length === 0) {
      pendingGrid.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-thumbs-up"></i>
          <p>No pending submissions. All cleared!</p>
        </div>
      `;
      return;
    }

    pendingGrid.innerHTML = adminState.pendingList.map(img => `
      <div class="frame-card">
        <div class="card-preview-wrapper">
          <img src="${img.url}" alt="Pending Photo">
        </div>
        <div class="card-info">
          <div class="card-meta">
            <span>ID: ${img.filename.split('_')[2]?.substring(0,4) || 'N/A'}</span>
            <span>${formatTime(img.timestamp)}</span>
          </div>
        </div>
        <div class="card-actions">
          <button class="btn-approve" onclick="approveFrame('${img.filename}')">
            <i class="fa-solid fa-check"></i> APPROVE
          </button>
          <a href="${img.url}" download="${img.filename}" class="btn-download-admin" title="Download Poster">
            <i class="fa-solid fa-download"></i>
          </a>
          <button class="btn-reject" onclick="rejectFrame('${img.filename}')">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    `).join('');
  }

  function renderAdminApproved() {
    if (adminState.approvedList.length === 0) {
      approvedGrid.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-image"></i>
          <p>No photos approved yet. Approved frames show up here.</p>
        </div>
      `;
      return;
    }

    approvedGrid.innerHTML = adminState.approvedList.map(img => `
      <div class="frame-card">
        <div class="card-preview-wrapper">
          <img src="${img.url}" alt="Approved Photo">
        </div>
        <div class="card-info">
          <div class="card-meta">
            <span>ID: ${img.filename.split('_')[2]?.substring(0,4) || 'N/A'}</span>
            <span>${formatTime(img.timestamp)}</span>
          </div>
        </div>
        <div class="card-actions" style="gap: 8px;">
          <button class="btn-revoke" onclick="rejectFrame('${img.filename}', true)" style="flex: 1;">
            <i class="fa-solid fa-circle-minus"></i> REVOKE POST
          </button>
          <a href="${img.url}" download="${img.filename}" class="btn-download-admin" title="Download Poster">
            <i class="fa-solid fa-download"></i>
          </a>
        </div>
      </div>
    `).join('');
  }

  // Global methods for button hooks
  window.approveFrame = async (filename) => {
    try {
      const res = await fetch('/api/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
      });
      if (res.ok) {
        showToast('Frame approved and posted to Story Wall!');
        refreshAdminFeeds();
      } else {
        showToast('Failed to approve submission.', true);
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to approve submission.', true);
    }
  };

  window.rejectFrame = async (filename, isApproved = false) => {
    const confirmMsg = isApproved 
      ? 'Are you sure you want to remove this image from the Story Wall? This deletes the file permanently.'
      : 'Are you sure you want to delete this pending submission?';
      
    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch('/api/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
      });
      if (res.ok) {
        showToast(isApproved ? 'Post revoked and deleted.' : 'Submission deleted.');
        refreshAdminFeeds();
      } else {
        showToast('Failed to delete submission.', true);
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to delete submission.', true);
    }
  };

  function startAdminPolling() {
    fetchConfig();
    refreshAdminFeeds();
    adminInterval = setInterval(refreshAdminFeeds, 3000);
  }

  function stopAdminPolling() {
    if (adminInterval) {
      clearInterval(adminInterval);
      adminInterval = null;
    }
  }

  /* --- Live Wall Slideshow Code --- */
  // Configure instruction URL dynamically based on address bar location
  const wallBaseUrl = window.location.origin;
  liveUrlDisplay.textContent = wallBaseUrl.replace(/^https?:\/\//, '');

  async function pollApprovedWallFeeds() {
    try {
      const res = await fetch('/api/approved');
      const data = await res.json();
      const newImages = data.images;

      // Check differences in lists
      let listChanged = false;
      if (wallApprovedImages.length !== newImages.length) {
        listChanged = true;
      } else {
        for (let i = 0; i < newImages.length; i++) {
          if (wallApprovedImages[i].filename !== newImages[i].filename) {
            listChanged = true;
            break;
          }
        }
      }

      if (listChanged) {
        wallApprovedImages = newImages;
        console.log(`[Story Wall] Updated slides count: ${wallApprovedImages.length}`);
        
        if (wallApprovedImages.length > 0) {
          if (wallCurrentIdx === -1) {
            wallCurrentIdx = 0;
            displayActiveWallSlide();
            startWallSlideshowTimer();
          }
        } else {
          wallCurrentIdx = -1;
          stopWallSlideshowTimer();
          renderWallEmptyState();
        }
      }
    } catch (err) {
      console.error('Failed to pull wall approved items:', err);
    }
  }

  function renderWallEmptyState() {
    slideContainer.innerHTML = `
      <div class="slide active">
        <div class="empty-wall-slide">
          <i class="fa-solid fa-wand-magic-sparkles"></i>
          <h3>The Wall is Warming Up</h3>
          <p>Scanning the network for customized participant badges. Open the generator, insert your selfie, and push it to the wall!</p>
        </div>
      </div>
    `;
    ambientBg.style.backgroundImage = 'none';
  }

  function displayActiveWallSlide() {
    if (wallApprovedImages.length === 0 || wallCurrentIdx < 0) return;
    if (wallCurrentIdx >= wallApprovedImages.length) wallCurrentIdx = 0;

    const imgData = wallApprovedImages[wallCurrentIdx];
    const nextUrl = imgData.url;

    // Create crossfade node
    const newSlide = document.createElement('div');
    newSlide.className = 'slide';
    newSlide.innerHTML = `<img src="${nextUrl}" alt="Hackathon Participant">`;

    // Preload
    const imgPreload = new Image();
    imgPreload.onload = () => {
      // Remove old slide nodes
      const oldSlides = slideContainer.querySelectorAll('.slide');
      oldSlides.forEach(slide => {
        slide.classList.remove('active');
        setTimeout(() => slide.remove(), 1200);
      });

      slideContainer.appendChild(newSlide);
      newSlide.getBoundingClientRect(); // force layout repaint
      newSlide.classList.add('active');

      // Blur backdrop
      ambientBg.style.backgroundImage = `url(${nextUrl})`;
    };
    imgPreload.src = nextUrl;
  }

  function rotateWallSlideNext() {
    if (wallApprovedImages.length <= 1) return;
    wallCurrentIdx = (wallCurrentIdx + 1) % wallApprovedImages.length;
    displayActiveWallSlide();
  }

  function startWallSlideshowTimer() {
    if (slideTimer) clearInterval(slideTimer);
    slideTimer = setInterval(rotateWallSlideNext, wallRotationInterval);
  }

  function stopWallSlideshowTimer() {
    if (slideTimer) {
      clearInterval(slideTimer);
      slideTimer = null;
    }
  }

  function startWallCarousel() {
    pollApprovedWallFeeds();
    wallInterval = setInterval(pollApprovedWallFeeds, 8000);
  }

  function stopWallCarousel() {
    stopWallSlideshowTimer();
    if (wallInterval) {
      clearInterval(wallInterval);
      wallInterval = null;
    }
  }

  // Bind Manual Projection Wall Arrow Navigation Controls
  const prevSlideBtn = document.getElementById('prevSlideBtn');
  const nextSlideBtn = document.getElementById('nextSlideBtn');

  prevSlideBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (wallApprovedImages.length <= 1) return;
    wallCurrentIdx = (wallCurrentIdx - 1 + wallApprovedImages.length) % wallApprovedImages.length;
    displayActiveWallSlide();
    startWallSlideshowTimer(); // Reset auto rotation interval
  });

  nextSlideBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (wallApprovedImages.length <= 1) return;
    wallCurrentIdx = (wallCurrentIdx + 1) % wallApprovedImages.length;
    displayActiveWallSlide();
    startWallSlideshowTimer(); // Reset auto rotation interval
  });

});
