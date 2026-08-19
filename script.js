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

    // Calculate aspect ratio cover scale for frameBox
    const scaleW = frameBox.width / userImg.width;
    const scaleH = frameBox.height / userImg.height;
    // Cover the box nicely
    imgState.baseScale = Math.max(scaleW, scaleH);
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

  /* ==========================================================================
     MAIN CANVAS RENDERING ENGINE (1200 x 1500)
     ========================================================================== */

  function renderCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. DRAW POSTER BACKGROUND
    drawBackground();

    // 2. DRAW USER PHOTO (CLIPPED BEHIND FRAME WINDOW)
    drawUserPhoto();

    // 3. DRAW FRAME OVERLAY & BRANDING GRAPHICS
    drawFrameOverlay();
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
    link.download = `HackTillDawn3_${cleanName}_Frame.png`;
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast("Frame downloaded successfully!");
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

});
