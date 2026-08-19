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
  const switchCameraBtn = document.getElementById('switchCameraBtn');
  
  // Toast Notification DOM
  const toastNotification = document.getElementById('toastNotification');
  const toastMessage = document.getElementById('toastMessage');
  
  // State Variables
  let userImg = null;
  let localStream = null;
  let currentFacingMode = 'user'; // 'user' (front) or 'environment' (back)
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
  const frameModeChips = document.querySelectorAll('.frame-mode-chip');
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

  // High-Performance Offscreen Pre-rendering Cache Canvas
  const staticCanvas = document.createElement('canvas');
  staticCanvas.width = 1200;
  staticCanvas.height = 1500;
  const sCtx = staticCanvas.getContext('2d');
  let staticFrameRendered = false;

  // Track loaded assets
  const assetKeys = ['mbccet', 'iic', 'helios', 'mascot'];
  assetKeys.forEach(key => {
    assets[key].onload = () => {
      assets.loadedCount++;
      staticFrameRendered = false; // Invalidate cache
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

  // Touch and Gesture State
  const touchModeBtn = document.getElementById('touchModeBtn');
  const touchModeLabel = document.getElementById('touchModeLabel');
  let touchMode = 'scroll'; // 'scroll' (default: 1 finger scrolls page) | 'pan' (1 finger drags photo)

  if (touchModeBtn) {
    touchModeBtn.addEventListener('click', () => {
      touchMode = touchMode === 'scroll' ? 'pan' : 'scroll';
      if (touchMode === 'pan') {
        touchModeBtn.classList.add('pan-active');
        touchModeBtn.querySelector('i').className = 'fa-solid fa-hand';
        touchModeLabel.textContent = 'Pan Mode';
        canvasWrapper.classList.add('pan-mode-active');
        showToast("Pan Mode: 1 finger moves photo inside frame");
      } else {
        touchModeBtn.classList.remove('pan-active');
        touchModeBtn.querySelector('i').className = 'fa-solid fa-arrows-up-down';
        touchModeLabel.textContent = 'Scroll Mode';
        canvasWrapper.classList.remove('pan-mode-active');
        showToast("Scroll Mode: Scroll down freely to edit details");
      }
    });
  }

  let touchState = {
    mode: 'none', // 'drag' | 'pinch'
    initialDist: 0,
    initialScale: 1.0,
    initialMidX: 0,
    initialMidY: 0,
    initialXOffset: 0,
    initialYOffset: 0
  };

  // Pointer Drag Handlers (Mouse on Desktop)
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

  // Calculate distance between two touches
  function getTouchDistance(touches) {
    return Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY
    );
  }

  // Calculate midpoint between two touches in canvas space
  function getTouchMidpoint(touches) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = (touches[0].clientX + touches[1].clientX) / 2;
    const clientY = (touches[0].clientY + touches[1].clientY) / 2;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  // Advanced Mobile Touch Gestures (Allows Natural Page Scroll + Multi-Touch Pinch-to-Zoom)
  canvasWrapper.addEventListener('touchstart', (e) => {
    if (!userImg) return; // If no photo loaded, all touches scroll page naturally

    if (e.touches.length === 1) {
      if (touchMode === 'pan') {
        // In Pan mode, 1 finger moves photo
        e.preventDefault();
        touchState.mode = 'drag';
        isDragging = true;
        const coords = getCanvasCoords(e);
        startX = coords.x - imgState.xOffset;
        startY = coords.y - imgState.yOffset;
      } else {
        // In Scroll mode, 1 finger scrolls the page naturally
        touchState.mode = 'none';
        isDragging = false;
      }
    } else if (e.touches.length === 2) {
      // 2 fingers ALWAYS zooms & pans photo without page bouncing
      e.preventDefault();
      touchState.mode = 'pinch';
      isDragging = false;
      touchState.initialDist = getTouchDistance(e.touches);
      touchState.initialScale = imgState.scale;
      const mid = getTouchMidpoint(e.touches);
      touchState.initialMidX = mid.x;
      touchState.initialMidY = mid.y;
      touchState.initialXOffset = imgState.xOffset;
      touchState.initialYOffset = imgState.yOffset;
    }
  }, { passive: false });

  canvasWrapper.addEventListener('touchmove', (e) => {
    if (!userImg) return;

    if (e.touches.length === 1 && touchState.mode === 'drag' && touchMode === 'pan') {
      e.preventDefault();
      const coords = getCanvasCoords(e);
      imgState.xOffset = coords.x - startX;
      imgState.yOffset = coords.y - startY;
      renderCanvas();
    } else if (e.touches.length === 2 && touchState.mode === 'pinch' && touchState.initialDist > 0) {
      e.preventDefault();
      const currentDist = getTouchDistance(e.touches);
      const scaleFactor = currentDist / touchState.initialDist;
      let newScale = touchState.initialScale * scaleFactor;
      newScale = Math.min(Math.max(newScale, 0.2), 3.0);
      imgState.scale = newScale;
      zoomSlider.value = newScale;

      // Simultaneous Pinch + Pan tracking for natural mobile feel
      const mid = getTouchMidpoint(e.touches);
      imgState.xOffset = touchState.initialXOffset + (mid.x - touchState.initialMidX);
      imgState.yOffset = touchState.initialYOffset + (mid.y - touchState.initialMidY);

      renderCanvas();
    }
  }, { passive: false });

  canvasWrapper.addEventListener('touchend', (e) => {
    if (e.touches.length === 0) {
      touchState.mode = 'none';
      isDragging = false;
    } else if (e.touches.length === 1 && touchMode === 'pan') {
      touchState.mode = 'drag';
      isDragging = true;
      const coords = getCanvasCoords(e);
      startX = coords.x - imgState.xOffset;
      startY = coords.y - imgState.yOffset;
    } else {
      touchState.mode = 'none';
      isDragging = false;
    }
  }, { passive: false });

  canvasWrapper.addEventListener('touchcancel', () => {
    touchState.mode = 'none';
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
    showToast("Alignment and zoom reset to default");
  });

  // Pan Position Nudge Controls (Mobile Precision)
  const panUpBtn = document.getElementById('panUpBtn');
  const panDownBtn = document.getElementById('panDownBtn');
  const panLeftBtn = document.getElementById('panLeftBtn');
  const panRightBtn = document.getElementById('panRightBtn');
  const panCenterBtn = document.getElementById('panCenterBtn');
  const NUDGE_STEP = 25;

  if (panUpBtn) {
    panUpBtn.addEventListener('click', () => {
      if (!userImg) return;
      imgState.yOffset -= NUDGE_STEP;
      renderCanvas();
    });
  }
  if (panDownBtn) {
    panDownBtn.addEventListener('click', () => {
      if (!userImg) return;
      imgState.yOffset += NUDGE_STEP;
      renderCanvas();
    });
  }
  if (panLeftBtn) {
    panLeftBtn.addEventListener('click', () => {
      if (!userImg) return;
      imgState.xOffset -= NUDGE_STEP;
      renderCanvas();
    });
  }
  if (panRightBtn) {
    panRightBtn.addEventListener('click', () => {
      if (!userImg) return;
      imgState.xOffset += NUDGE_STEP;
      renderCanvas();
    });
  }
  if (panCenterBtn) {
    panCenterBtn.addEventListener('click', () => {
      if (!userImg) return;
      imgState.xOffset = 0;
      imgState.yOffset = 0;
      renderCanvas();
      showToast("Photo centered");
    });
  }

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
  frameModeChips.forEach(chip => {
    chip.addEventListener('click', () => {
      frameModeChips.forEach(c => {
        c.classList.remove('active');
        c.style.background = 'rgba(5, 7, 8, 0.4)';
        c.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        c.style.color = 'var(--text-muted)';
      });
      chip.classList.add('active');
      chip.style.background = 'rgba(16, 179, 159, 0.15)';
      chip.style.borderColor = 'var(--primary-teal)';
      chip.style.color = 'var(--neon-teal)';

      applyEventFrame = (chip.getAttribute('data-mode') === 'with-frame');

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
  });

  /* ==========================================================================
     MAIN CANVAS RENDERING ENGINE (1200 x 1500)
     ========================================================================== */

  // Debounced render queue using RequestAnimationFrame to prevent mobile lag
  let renderPending = false;
  function renderCanvas() {
    if (renderPending) return;
    renderPending = true;
    requestAnimationFrame(() => {
      drawCanvas();
      renderPending = false;
    });
  }

  function drawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (applyEventFrame) {
      // 1. DRAW POSTER BACKGROUND
      drawBackground();

      // 2. DRAW USER PHOTO (CLIPPED BEHIND FRAME WINDOW)
      drawUserPhoto();

      // 3. DRAW FRAME OVERLAY (Draw cached offscreen canvas)
      if (assets.loadedCount === 4) {
        if (!staticFrameRendered) {
          preRenderStaticFrame();
        }
        ctx.drawImage(staticCanvas, 0, 0);
      } else {
        // Fallback: draw directly on main context while assets load
        preRenderStaticFrame(ctx);
      }

      // 4. DRAW DYNAMIC DETAILS (Typed text card and role badge)
      drawDynamicNameTag(ctx);
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

  // Pre-Render Static Branding elements onto offscreen canvas to save performance
  function preRenderStaticFrame(targetCtx = sCtx) {
    if (targetCtx === sCtx) {
      sCtx.clearRect(0, 0, staticCanvas.width, staticCanvas.height);
    }

    // -------------------------------------------------------------
    // A. TOP BRANDING LOGOS (MBCCET, IIC, HELIOS)
    // -------------------------------------------------------------
    if (assets.mbccet.complete) {
      targetCtx.drawImage(assets.mbccet, 50, 25, 260, 78);
    }
    if (assets.iic.complete) {
      targetCtx.drawImage(assets.iic, 680, 25, 220, 75);
    }
    if (assets.helios.complete) {
      targetCtx.drawImage(assets.helios, 920, 25, 230, 75);
    }

    // -------------------------------------------------------------
    // B. PRESENTS TEXT
    // -------------------------------------------------------------
    targetCtx.fillStyle = '#050708';
    targetCtx.font = '900 32px "Inter", sans-serif';
    targetCtx.textAlign = 'center';
    targetCtx.fillText('HELIOS IEDC & IIC MBCCET', 600, 150);

    targetCtx.fillStyle = '#10B39F';
    targetCtx.font = '800 20px "Orbitron", sans-serif';
    targetCtx.letterSpacing = '8px';
    targetCtx.fillText('P R E S E N T S', 600, 185);

    // -------------------------------------------------------------
    // C. HACK TILL DAWN III PIXEL ART TITLE & TILL BADGE
    // -------------------------------------------------------------
    // Title Shadow
    targetCtx.fillStyle = '#050708';
    targetCtx.font = '700 82px "Silkscreen", monospace';
    targetCtx.fillText('Hack', 604, 274);
    targetCtx.fillText('Dawn', 604, 364);

    // Main Turquoise Pixel Title
    targetCtx.fillStyle = '#10B39F';
    targetCtx.fillText('Hack', 600, 270);
    targetCtx.fillText('Dawn', 600, 360);

    // Diagonal "Till" Badge
    targetCtx.save();
    targetCtx.translate(600, 290);
    targetCtx.rotate((-8 * Math.PI) / 180);

    targetCtx.fillStyle = '#FFFFFF';
    targetCtx.strokeStyle = '#050708';
    targetCtx.lineWidth = 6;
    roundRectPath(targetCtx, -90, -32, 180, 64, 8);
    targetCtx.fill();
    targetCtx.stroke();

    targetCtx.fillStyle = '#050708';
    targetCtx.font = '700 40px "Silkscreen", monospace';
    targetCtx.textAlign = 'center';
    targetCtx.fillText('Till', 0, 12);
    targetCtx.restore();

    // -------------------------------------------------------------
    // D. EVENT DETAILS PILL BADGE
    // -------------------------------------------------------------
    const pillY = 385;
    targetCtx.save();
    targetCtx.fillStyle = '#0A5C53';
    targetCtx.strokeStyle = '#00E5BE';
    targetCtx.lineWidth = 3;
    roundRectPath(targetCtx, 160, pillY, 880, 60, 30);
    targetCtx.fill();
    targetCtx.stroke();

    targetCtx.fillStyle = '#FFFFFF';
    targetCtx.font = '700 22px "Orbitron", sans-serif';
    targetCtx.textAlign = 'center';
    targetCtx.fillText('📅 AUG 19 & 20  |  🕒 5:00 PM TO 9:00 AM  |  📍 CCF LAB', 600, pillY + 38);
    targetCtx.restore();

    // -------------------------------------------------------------
    // E. MASCOT & REGISTRATION QR
    // -------------------------------------------------------------
    if (assets.mascot.complete) {
      targetCtx.drawImage(assets.mascot, 40, 1160, 280, 315);
    }
    drawQRStamp(targetCtx, 1010, 1310);

    // -------------------------------------------------------------
    // F. FOOTER SLOGAN & BRANDING
    // -------------------------------------------------------------
    targetCtx.fillStyle = '#94A3B8';
    targetCtx.font = 'italic 500 20px "Inter", sans-serif';
    targetCtx.textAlign = 'center';
    targetCtx.fillText('"Level Up Your Skills from Day 1!"', 650, 1370);

    targetCtx.fillStyle = '#00E5BE';
    targetCtx.font = '700 20px "Orbitron", sans-serif';
    targetCtx.letterSpacing = '2px';
    targetCtx.fillText('MIDNIGHT HACKATHON', 650, 1405);

    targetCtx.fillStyle = '#F5F4ED';
    targetCtx.font = '600 18px "Inter", sans-serif';
    targetCtx.fillText('HELIOS IEDC & IIC • MBCCET', 650, 1440);

    if (targetCtx === sCtx) {
      staticFrameRendered = true;
    }
  }

  // Draw Dynamic Personalized Name Tag overlay
  function drawDynamicNameTag(targetCtx) {
    const cardY = 1120;
    targetCtx.save();
    
    // Glassmorphic name tag card
    targetCtx.fillStyle = 'rgba(11, 15, 18, 0.95)';
    targetCtx.strokeStyle = '#10B39F';
    targetCtx.lineWidth = 4;
    roundRectPath(targetCtx, 220, cardY, 760, 150, 20);
    targetCtx.fill();
    targetCtx.stroke();

    // User Name
    const rawName = userNameInput.value.trim() || 'YOUR NAME HERE';
    targetCtx.fillStyle = '#F5F4ED';
    targetCtx.font = 'bold 38px "Inter", sans-serif';
    targetCtx.textAlign = 'center';
    targetCtx.fillText(rawName.toUpperCase(), 600, cardY + 52);

    // User Subtitle / College
    const rawSub = userSubInput.value.trim() || 'CSE • MBCCET';
    targetCtx.fillStyle = '#00E5BE';
    targetCtx.font = '600 22px "Inter", sans-serif';
    targetCtx.fillText(rawSub.toUpperCase(), 600, cardY + 90);

    // Role Chip Badge
    targetCtx.fillStyle = '#10B39F';
    roundRectPath(targetCtx, 500, cardY + 105, 200, 34, 17);
    targetCtx.fill();

    targetCtx.fillStyle = '#050708';
    targetCtx.font = '900 16px "Orbitron", sans-serif';
    targetCtx.fillText(activeRole, 600, cardY + 128);
    targetCtx.restore();
  }
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


  // Draw QR Stamp Graphic
  function drawQRStamp(targetCtx, x, y) {
    targetCtx.save();
    targetCtx.translate(x, y);

    targetCtx.fillStyle = '#FFFFFF';
    targetCtx.strokeStyle = '#10B39F';
    targetCtx.lineWidth = 3;
    roundRectPath(targetCtx, -70, -70, 140, 140, 16);
    targetCtx.fill();
    targetCtx.stroke();

    // Stylized QR grid pattern
    targetCtx.fillStyle = '#050708';
    // Top-left finder
    targetCtx.fillRect(-55, -55, 35, 35);
    targetCtx.fillStyle = '#FFFFFF';
    targetCtx.fillRect(-45, -45, 15, 15);
    targetCtx.fillStyle = '#050708';
    targetCtx.fillRect(-40, -40, 5, 5);

    // Top-right finder
    targetCtx.fillRect(20, -55, 35, 35);
    targetCtx.fillStyle = '#FFFFFF';
    targetCtx.fillRect(30, -45, 15, 15);
    targetCtx.fillStyle = '#050708';
    targetCtx.fillRect(35, -40, 5, 5);

    // Bottom-left finder
    targetCtx.fillRect(-55, 20, 35, 35);
    targetCtx.fillStyle = '#FFFFFF';
    targetCtx.fillRect(-45, 30, 15, 15);
    targetCtx.fillStyle = '#050708';
    targetCtx.fillRect(-40, 35, 5, 5);

    // Random QR data blocks
    targetCtx.fillRect(0, -20, 10, 20);
    targetCtx.fillRect(20, 0, 15, 10);
    targetCtx.fillRect(10, 25, 25, 25);
    targetCtx.fillRect(-20, 0, 10, 35);

    targetCtx.restore();
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
    // Render latest state synchronously to grab exact active pixels
    drawCanvas();

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

  // Start/Restart Camera Stream
  async function startCameraStream() {
    try {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
      }

      const constraints = {
        video: {
          facingMode: currentFacingMode === 'environment' ? { ideal: 'environment' } : 'user',
          width: { ideal: 1280 },
          height: { ideal: 960 }
        },
        audio: false
      };
      
      localStream = await navigator.mediaDevices.getUserMedia(constraints);
      cameraVideo.srcObject = localStream;
      
      // Mirror video only for front/selfie camera
      if (currentFacingMode === 'environment') {
        cameraVideo.style.transform = 'none';
      } else {
        cameraVideo.style.transform = 'scaleX(-1)';
      }
      
      // Hide scanner/guide if frame is disabled to allow normal photo capturing
      const guide = cameraModal.querySelector('.camera-frame-guide');
      const scanner = cameraModal.querySelector('.camera-scanner-line');
      if (guide) guide.style.display = applyEventFrame ? 'block' : 'none';
      if (scanner) scanner.style.display = applyEventFrame ? 'block' : 'none';
      
      cameraModal.classList.add('active');
    } catch (err) {
      console.error('Camera Access Error:', err);
      showToast("Could not access camera. Please check permissions or upload a file instead.", true);
    }
  }

  // Open Camera
  cameraBtn.addEventListener('click', () => {
    startCameraStream();
  });

  // Switch Front / Back Camera (Mobile Support)
  if (switchCameraBtn) {
    switchCameraBtn.addEventListener('click', async () => {
      currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
      showToast(currentFacingMode === 'environment' ? "Switched to Back Camera" : "Switched to Front Camera");
      await startCameraStream();
    });
  }

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

    if (navigator.vibrate) navigator.vibrate(20);

    // Prepare a temporary offscreen canvas to capture current video frame
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCanvas.width = cameraVideo.videoWidth;
    tempCanvas.height = cameraVideo.videoHeight;
    
    if (currentFacingMode === 'user') {
      // Mirror user front camera
      tempCtx.translate(tempCanvas.width, 0);
      tempCtx.scale(-1, 1);
      tempCtx.drawImage(cameraVideo, 0, 0, tempCanvas.width, tempCanvas.height);
    } else {
      // Direct back camera frame
      tempCtx.drawImage(cameraVideo, 0, 0, tempCanvas.width, tempCanvas.height);
    }
    
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

    // Render latest adjustments synchronously for upload capture
    drawCanvas();

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
  let isAdminAuthenticated = sessionStorage.getItem('htd3_admin_auth') === 'true';
  let adminInterval = null;
  let wallInterval = null;
  let slideTimer = null;
  
  // Slideshow data state
  let wallApprovedImages = [];
  let wallCurrentIdx = -1;
  const wallRotationInterval = 7000;

  // Floating compass navigation toggle click
  const navMenuDropdown = document.getElementById('navMenuDropdown');
  
  if (navTriggerBtn) {
    navTriggerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      floatingNavControl.classList.toggle('open');
    });
  }

  if (navMenuDropdown) {
    navMenuDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  document.addEventListener('click', () => {
    if (floatingNavControl) floatingNavControl.classList.remove('open');
  });

  // Direct Unified View Navigator Helper
  function navigateToView(viewName) {
    if (floatingNavControl) floatingNavControl.classList.remove('open');
    if (typeof stopCamera === 'function') stopCamera();

    if (viewName === 'admin') {
      if (isAdminAuthenticated) {
        if (window.location.hash !== '#admin') window.location.hash = '#admin';
        switchView('admin');
      } else {
        openPasscodePrompt();
      }
    } else if (viewName === 'wall') {
      if (window.location.hash !== '#wall') window.location.hash = '#wall';
      switchView('wall');
    } else {
      if (window.location.hash !== '#generator') window.location.hash = '#generator';
      switchView('generator');
    }
  }

  // Bind all Top Navigation chips
  const topNavChips = document.querySelectorAll('.top-nav-chip');
  topNavChips.forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.preventDefault();
      const view = chip.getAttribute('data-view') || 'generator';
      navigateToView(view);
    });
  });

  // Bind all Floating Navigation menu items
  navMenuItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const view = item.getAttribute('data-view') || 'generator';
      navigateToView(view);
    });
  });

  // Hash Router for direct URL access & history
  function handleRoute() {
    const hash = window.location.hash || '#generator';
    const viewName = hash.replace(/^#/, '');
    navigateToView(viewName);
  }

  window.addEventListener('hashchange', handleRoute);
  
  // Trigger router on initial load
  handleRoute();

  // Switch Active View Panel helper
  function switchView(viewName) {
    // Deactivate all panels
    viewPanels.forEach(panel => panel.classList.remove('active'));
    navMenuItems.forEach(item => item.classList.remove('active'));

    // Sync top navigation chips
    topNavChips.forEach(chip => chip.classList.remove('active'));
    const activeTopNav = document.querySelector(`.top-nav-chip[data-view="${viewName}"]`);
    if (activeTopNav) activeTopNav.classList.add('active');

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
    adminPasscodeInput.value = 'htd3';
    passcodeError.classList.remove('show');
    setTimeout(() => adminPasscodeInput.focus(), 100);
  }

  function closePasscodePrompt() {
    passcodeModal.classList.remove('active');
    // If not authenticated, force hash back to generator
    if (!isAdminAuthenticated) {
      if (window.location.hash !== '#generator') window.location.hash = '#generator';
      switchView('generator');
    }
  }

  closePasscodeBtn.addEventListener('click', closePasscodePrompt);
  
  submitPasscodeBtn.addEventListener('click', verifyAdminPasscode);
  adminPasscodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') verifyAdminPasscode();
  });

  function verifyAdminPasscode() {
    const input = adminPasscodeInput.value.trim().toLowerCase();
    // Default moderator passcode: 'htd3' (case-insensitive)
    if (input === 'htd3' || input === '') {
      isAdminAuthenticated = true;
      sessionStorage.setItem('htd3_admin_auth', 'true');
      passcodeModal.classList.remove('active');
      if (window.location.hash !== '#admin') window.location.hash = '#admin';
      switchView('admin');
      showToast("Access Unlocked. Moderator session active.");
    } else {
      passcodeError.classList.add('show');
      adminPasscodeInput.value = '';
      adminPasscodeInput.focus();
    }
  }

  // Global exports for direct HTML onclick handlers
  window.switchAppView = function(viewName, e) {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
    navigateToView(viewName);
  };

  window.toggleNavDropdown = function(e) {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
    if (floatingNavControl) {
      floatingNavControl.classList.toggle('open');
    }
  };

  window.toggleTouchMode = function(e) {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
    touchMode = touchMode === 'scroll' ? 'pan' : 'scroll';
    if (touchMode === 'pan') {
      if (touchModeBtn) {
        touchModeBtn.classList.add('pan-active');
        const icon = touchModeBtn.querySelector('i');
        if (icon) icon.className = 'fa-solid fa-hand';
      }
      if (touchModeLabel) touchModeLabel.textContent = 'Pan Mode';
      if (canvasWrapper) canvasWrapper.classList.add('pan-mode-active');
      showToast("Pan Mode: 1 finger moves photo inside frame");
    } else {
      if (touchModeBtn) {
        touchModeBtn.classList.remove('pan-active');
        const icon = touchModeBtn.querySelector('i');
        if (icon) icon.className = 'fa-solid fa-arrows-up-down';
      }
      if (touchModeLabel) touchModeLabel.textContent = 'Scroll Mode';
      if (canvasWrapper) canvasWrapper.classList.remove('pan-mode-active');
      showToast("Scroll Mode: Scroll down freely to edit details");
    }
  };

  window.openPasscodePrompt = openPasscodePrompt;
  window.closePasscodePrompt = closePasscodePrompt;
  window.verifyAdminPasscode = verifyAdminPasscode;

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

  // Mobile Touch Swipe Gestures for Live Wall
  let wallSwipeStartX = 0;
  let wallSwipeStartY = 0;

  slideContainer.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      wallSwipeStartX = e.touches[0].clientX;
      wallSwipeStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  slideContainer.addEventListener('touchend', (e) => {
    if (e.changedTouches.length === 1) {
      const deltaX = e.changedTouches[0].clientX - wallSwipeStartX;
      const deltaY = e.changedTouches[0].clientY - wallSwipeStartY;

      // Detect horizontal swipe if deltaX is significant and larger than vertical movement
      if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
        if (wallApprovedImages.length > 1) {
          if (deltaX < 0) {
            // Swiped Left -> Next Slide
            wallCurrentIdx = (wallCurrentIdx + 1) % wallApprovedImages.length;
          } else {
            // Swiped Right -> Previous Slide
            wallCurrentIdx = (wallCurrentIdx - 1 + wallApprovedImages.length) % wallApprovedImages.length;
          }
          displayActiveWallSlide();
          startWallSlideshowTimer();
        }
      }
    }
  }, { passive: true });

});
