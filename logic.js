// ====== GLOBALS & SELECTORS ======
const dropZone = document.getElementById('drop-zone');
const container = document.getElementById('container');
let imageCounter = 0;
const GRID_SIZE   = 20;
const MIN_ZOOM    = 0.5;
const MAX_ZOOM    = 3;
const ZOOM_SENSITIVITY = 0.02;

let zoomLevel  = 1;
let panOffset  = { x: 0, y: 0 };

// Tracking pointer interactions
let action     = null;             // 'panning' | 'dragging' | 'resizing'
let activeEl   = null;
let startPoint = { x: 0, y: 0 };
let initialPan = { x: 0, y: 0 };
let elStart    = { x: 0, y: 0 };
let initSize   = { w: 0, h: 0 };

// ====== UTILITY FUNCTIONS ======
function clampPan() {
  const rect = dropZone.getBoundingClientRect();
  const cw   = container.clientWidth;
  const ch   = container.clientHeight;
  const maxX = 0;
  const minX = cw - rect.width;
  const maxY = 0;
  const minY = ch - rect.height;
  panOffset.x = Math.min(maxX, Math.max(minX, panOffset.x));
  panOffset.y = Math.min(maxY, Math.max(minY, panOffset.y));
}

function applyTransform() {
  dropZone.style.transform = `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`;
}

// ====== DRAG-AND-DROP FILE HANDLING ======
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event =>
    dropZone.addEventListener(event, e => e.preventDefault())
);

function snapToGrid(value) {
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

function makeDraggable(wrapper) {
  wrapper.style.position = 'absolute';        // ensure we can use left/top
  wrapper.style.touchAction = 'none';         // disable default touch panning

  wrapper.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const dropRect = dropZone.getBoundingClientRect();

    // 1) Map the mouse into drop-zone local, un-zoomed coordinates:
    const startLocalX = (e.clientX - dropRect.left  - panOffset.x) / zoomLevel;
    const startLocalY = (e.clientY - dropRect.top   - panOffset.y) / zoomLevel;

    // 2) Record where the wrapper already sits in that same space:
    const initialLeft = parseFloat(wrapper.style.left) || 0;
    const initialTop  = parseFloat(wrapper.style.top)  || 0;

    // highlight selection
    document.querySelectorAll('.file-wrapper').forEach(el => el.classList.remove('selected'));
    wrapper.classList.add('selected');

    // pointermove handler:
    const onPointerMove = (moveEvent) => {
      // convert the new mouse pos into the same canvas coords:
      const currentLocalX = (moveEvent.clientX - dropRect.left  - panOffset.x) / zoomLevel;
      const currentLocalY = (moveEvent.clientY - dropRect.top   - panOffset.y) / zoomLevel;

      // Δ from where we first grabbed:
      const dx = currentLocalX - startLocalX;
      const dy = currentLocalY - startLocalY;

      // snap to your grid and update style:
      const snappedX = snapToGrid(initialLeft + dx);
      const snappedY = snapToGrid(initialTop  + dy);

      wrapper.style.left = `${snappedX}px`;
      wrapper.style.top  = `${snappedY}px`;
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', () => {
      document.removeEventListener('pointermove', onPointerMove);
    }, { once: true });
  });
}

function enableResizing(wrapper, handle) {
    let startX, startW, startH, aspect;
  
    handle.addEventListener('pointerdown', e => {
      e.stopPropagation();
      e.preventDefault();
  
      startX = e.clientX;
      startW = wrapper.offsetWidth;
      startH = wrapper.offsetHeight;
      aspect = startH / startW;   // capture H/W at drag start
  
      function onPointerMove(e) {
        // 1) pick a single delta – here we use horizontal movement:
        const dx = (e.clientX - startX) / zoomLevel;
  
        // 2) compute the new “base” size, clamp to at least one grid cell:
        let base = startW + dx;
        base = Math.max(base, GRID_SIZE);
  
        // 3) snap that to your grid:
        const snappedBase = Math.round(base / GRID_SIZE) * GRID_SIZE;
  
        // 4) new width is snappedBase; new height keeps the same ratio:
        const newW = snappedBase;
        const newH = Math.round(newW * aspect / GRID_SIZE) * GRID_SIZE;
  
        // 5) apply to both wrapper and img
        wrapper.style.width  = `${newW}px`;
        wrapper.style.height = `${newH}px`;
        const img = wrapper.querySelector('img');
        if (img) {
          img.style.width  = `${newW}px`;
          img.style.height = `${newH}px`;
        }
      }
  
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', () => {
        document.removeEventListener('pointermove', onPointerMove);
      }, { once: true });
    });
} 

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    for (const file of files) {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            
            reader.onload = function (event) {
                const wrapper = document.createElement('div');
                wrapper.classList.add('file-wrapper');
                wrapper.id = `file-${imageCounter++}`;
                wrapper.style.position = 'absolute';
            
                // Define a consistent initial wrapper size
                const FIXED_WIDTH = 300;
                const FIXED_HEIGHT = 300;
                const snappedWidth  = Math.round(FIXED_WIDTH  / GRID_SIZE) * GRID_SIZE;
                const snappedHeight = Math.round(FIXED_HEIGHT / GRID_SIZE) * GRID_SIZE;
                wrapper.style.width  = `${snappedWidth}px`;
                wrapper.style.height = `${snappedHeight}px`;
            
                // Calculate drop position relative to pan/zoom and snap
                const containerRect = dropZone.getBoundingClientRect();
                const dropX = (mouseX - containerRect.left  - panOffset.x) / zoomLevel;
                const dropY = (mouseY - containerRect.top   - panOffset.y) / zoomLevel;
                const snappedLeft = Math.round(dropX / GRID_SIZE) * GRID_SIZE;
                const snappedTop  = Math.round(dropY / GRID_SIZE) * GRID_SIZE;
                wrapper.style.left = `${snappedLeft}px`;
                wrapper.style.top  = `${snappedTop}px`;
            
                // Create the image
                const img = document.createElement('img');
                img.src = event.target.result;
                img.draggable = false;
                img.classList.add('file-image');

                // once the image has actually loaded in the DOM,
                // grab its real displayed size and resize the wrapper to match.
                img.addEventListener('load', () => {
                  const displayedW = img.width;
                  const displayedH = img.height;
                  // grid-snap the final dimensions
                  const finalW = Math.round(displayedW / GRID_SIZE) * GRID_SIZE;
                  const finalH = Math.round(displayedH / GRID_SIZE) * GRID_SIZE;
                  wrapper.style.width  = `${finalW}px`;
                  wrapper.style.height = `${finalH}px`;
                });

                // Resize handle (no change)
                const resizeHandle = document.createElement('div');
                resizeHandle.classList.add('resize-handle');
            
                // Add to DOM
                wrapper.appendChild(img);
                wrapper.appendChild(resizeHandle);
                dropZone.appendChild(wrapper);
            
                // Initialize drag & resize
                makeDraggable(wrapper);
                enableResizing(wrapper, resizeHandle);
            };            

            reader.readAsDataURL(file);
        }
    }
});

// ====== ZOOM HANDLER ======
container.addEventListener('wheel', e => {
  if (!e.ctrlKey) return;
  e.preventDefault();

  const rect   = dropZone.getBoundingClientRect();
  const cx     = (e.clientX - rect.left ) / zoomLevel;
  const cy     = (e.clientY - rect.top  ) / zoomLevel;
  const delta  = -e.deltaY * ZOOM_SENSITIVITY;
  const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel + delta));

  panOffset.x -= cx * (newZoom - zoomLevel);
  panOffset.y -= cy * (newZoom - zoomLevel);
  zoomLevel    = newZoom;

  clampPan();
  applyTransform();
}, { passive: false });

// ====== POINTER INTERACTIONS ======
container.addEventListener('mousedown', e => {
  // Determine intent: pan vs drag vs resize
  if (e.target === container && e.altKey) {
    action     = 'panning';
    startPoint = { x: e.clientX, y: e.clientY };
    initialPan = { ...panOffset };
  }
  else if (e.target.classList.contains('resize-handle')) {
    action     = 'resizing';
    activeEl   = e.target.closest('.file-wrapper');
    startPoint = { x: e.clientX, y: e.clientY };
    initSize   = { w: activeEl.offsetWidth, h: activeEl.offsetHeight };
  }
  else if (e.target.closest('.file-wrapper')) {
    action     = 'dragging';
    activeEl   = e.target.closest('.file-wrapper');
    startPoint = { x: e.clientX, y: e.clientY };
    const rect  = activeEl.getBoundingClientRect();
    elStart     = {
      x: (rect.left - panOffset.x) / zoomLevel,
      y: (rect.top  - panOffset.y) / zoomLevel
    };
    document.querySelectorAll('.file-wrapper').forEach(el => el.classList.remove('selected'));
    activeEl.classList.add('selected');
  } else {
    return;
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup',   onMouseUp, { once: true });
  e.preventDefault();
});

function onMouseMove(e) {
  e.preventDefault();
  if (action === 'panning') {
    panOffset.x = initialPan.x + (e.clientX - startPoint.x);
    panOffset.y = initialPan.y + (e.clientY - startPoint.y);
    clampPan();
    applyTransform();
  }
  else if (action === 'dragging' && activeEl) {
    const dx = (e.clientX - startPoint.x) / zoomLevel;
    const dy = (e.clientY - startPoint.y) / zoomLevel;
    const x  = elStart.x + dx;
    const y  = elStart.y + dy;
    activeEl.style.transform = `translate(${x}px, ${y}px)`;
  }
  else if (action === 'resizing' && activeEl) {
    const dx = (e.clientX - startPoint.x) / zoomLevel;
    const dy = (e.clientY - startPoint.y) / zoomLevel;
    let newW = Math.round((initSize.w + dx) / GRID_SIZE) * GRID_SIZE;
    let newH = Math.round((initSize.h + dy) / GRID_SIZE) * GRID_SIZE;
    activeEl.style.width  = `${newW}px`;
    activeEl.style.height = `${newH}px`;
    const img = activeEl.querySelector('img');
    if (img) {
      img.style.width  = `${newW}px`;
      img.style.height = `${newH}px`;
    }
  }
}

function onMouseUp() {
  action   = null;
  activeEl = null;
  document.removeEventListener('mousemove', onMouseMove);
}