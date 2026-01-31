// Global color configuration - change these to update colors throughout the app
const GLOBAL_COLORS = {
    light: {
        // Grid background and basic states
        empty: '#ffffff',
        selected: '#f8b4b4',      // Light blue for selected cells
        resample: '#c29fff',      // Light red for resample tracks
        ignore: '#666666',        // Gray for ignored tracks
        mask: '#d0d0d0',          // Gray for masked bars
        // Step visualization
        context: '#b3ecff',       // Cyan for context
        generate: '#ff3b30',      // Red for generation
        stepMask: '#d0d0d0'       // Gray for step masking
    },
    dark: {
        // Grid background and basic states
        empty: '#1c1c1e',
        selected: '#5f1e1e',      // Dark blue for selected cells
        resample: '#561e5f',      // Dark red for resample tracks
        ignore: '#383838',        // Dark gray for ignored tracks
        mask: '#818080',          // Darker gray for masked bars
        // Step visualization
        context: '#2a4a5a',       // Dark cyan for context
        generate: '#ff3b30',      // Red for generation
        stepMask: '#818080'       // Gray for step masking
    }
};

// Alias for backward compatibility
const COLORS = GLOBAL_COLORS;

// Theme management
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update icon
    document.getElementById('themeName').textContent = newTheme === 'dark' ? 'Light Mode' : 'Dark Mode';
    
    // Update legend colors
    updateSelectionLegend();
    
    // Re-render grids with new theme
    renderGrid();
    if (state.steps.length > 0) {
        updateVisualization();
    }
}

// Initialize theme from localStorage
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.getElementById('themeName').textContent = savedTheme === 'dark' ? 'Light Mode' : 'Dark Mode';
    
    // Set current year
    document.getElementById('currentYear').textContent = new Date().getFullYear();
}

let state = {
    numTracks: 4,
    numBars: 8,
    selection: [],
    resampleMask: [],
    ignoreMask: [],
    barMask: [],
    mode: 'select',
    steps: [],
    currentStep: 0
};

function initializeGrid() {
    state.numTracks = parseInt(document.getElementById('tracks').value);
    state.numBars = parseInt(document.getElementById('bars').value);
    
    state.selection = Array(state.numTracks).fill(null).map(() => Array(state.numBars).fill(false));
    state.resampleMask = Array(state.numTracks).fill(false);
    state.ignoreMask = Array(state.numTracks).fill(false);
    state.barMask = Array(state.numTracks).fill(null).map(() => Array(state.numBars).fill(false));
    
    renderGrid();
    setupCanvasClickHandler();
}

function createDiagonalStripePattern(ctx, pSize, theme, stripeWidth = 4) {
    const pCanvas = document.createElement("canvas");
    pCanvas.width = pCanvas.height = pSize;
    const pCtx = pCanvas.getContext("2d");

    // Base color
    pCtx.fillStyle = theme.selected;
    pCtx.fillRect(0, 0, pSize, pSize);

    pCtx.strokeStyle = theme.mask;
    pCtx.lineWidth = stripeWidth;
    pCtx.lineCap = "butt";

    // Spacing between stripes = 2 * stripeWidth
    const spacing = stripeWidth * 3;

    // Draw enough diagonals to fully cover tile + wrapping
    for (let offset = -pSize; offset <= pSize * 3; offset += spacing) {
        pCtx.beginPath();
        pCtx.moveTo(offset, 0);
        pCtx.lineTo(offset + pSize, pSize);
        pCtx.stroke();
    }

    return ctx.createPattern(pCanvas, "repeat");
}

function renderGrid() {
    const canvas = document.getElementById('selectionCanvas');
    const ctx = canvas.getContext('2d');
    
    const cellSize = 40;
    canvas.width = state.numBars * cellSize;
    canvas.height = state.numTracks * cellSize;
    
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const theme = isDark ? COLORS.dark : COLORS.light;

    const diagonalPattern = createDiagonalStripePattern(ctx, cellSize, theme);
    
    const gridColor = isDark ? '#48484a' : '#e8e8ed';
    const darkGridColor = isDark ? '#f5f5f7' : '#1d1d1f';
    
    // Draw cells
    for (let i = 0; i < state.numTracks; i++) {
        for (let j = 0; j < state.numBars; j++) {
            const x = j * cellSize;
            const y = i * cellSize;
            
            let color = theme.empty;
            let isMasked = false;
            let isSelectedMasked = false;
            
            if (state.ignoreMask[i]) {
                color = theme.ignore;
            } else if (state.resampleMask[i]) {
                color = theme.resample;
            } else if (state.barMask[i][j] && state.selection[i][j]) {
                isSelectedMasked = true;
            } else if (state.barMask[i][j]) {
                isMasked = true;
            } else if (state.selection[i][j]) {
                color = theme.selected;
            }
            
            if (isSelectedMasked) {
                // Selected color with diagonal stripes
                //ctx.fillStyle = theme.selected;
                //ctx.fillRect(x, y, cellSize, cellSize);
                
                //ctx.fillStyle = theme.mask;
                //for (let stripe = -cellSize; stripe < cellSize * 2; stripe += 8) {
                //    ctx.fillRect(x + stripe, y, 4, cellSize);
                //}

                ctx.fillStyle = diagonalPattern; // cached result from above
                ctx.fillRect(x, y, cellSize, cellSize);
            } else if (isMasked) {
                // Solid mask color
                ctx.fillStyle = theme.mask;
                ctx.fillRect(x, y, cellSize, cellSize);
            } else {
                ctx.fillStyle = color;
                ctx.fillRect(x, y, cellSize, cellSize);
            }
        }
    }
    
    // Draw light grid lines
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    
    for (let j = 0; j <= state.numBars; j++) {
        ctx.beginPath();
        ctx.moveTo(j * cellSize, 0);
        ctx.lineTo(j * cellSize, canvas.height);
        ctx.stroke();
    }
    
    for (let i = 0; i <= state.numTracks; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * cellSize);
        ctx.lineTo(canvas.width, i * cellSize);
        ctx.stroke();
    }
    
    // Draw step decomposition grid if parameters are set
    const tracksPerStep = parseInt(document.getElementById('tracksPerStep').value);
    const barsPerStep = parseInt(document.getElementById('barsPerStep').value);
    
    ctx.strokeStyle = darkGridColor;
    ctx.lineWidth = 2;
    
    for (let j = 0; j <= state.numBars; j += barsPerStep) {
        ctx.beginPath();
        ctx.moveTo(j * cellSize, 0);
        ctx.lineTo(j * cellSize, canvas.height);
        ctx.stroke();
    }
    
    for (let i = 0; i <= state.numTracks; i += tracksPerStep) {
        ctx.beginPath();
        ctx.moveTo(0, i * cellSize);
        ctx.lineTo(canvas.width, i * cellSize);
        ctx.stroke();
    }
}

function setupCanvasClickHandler() {
    const canvas = document.getElementById('selectionCanvas');
    
    canvas.onclick = (event) => {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const cellSize = 40;
        const j = Math.floor(x / cellSize);
        const i = Math.floor(y / cellSize);
        
        if (i >= 0 && i < state.numTracks && j >= 0 && j < state.numBars) {
            handleCellClick(i, j);
        }
    };
    
    // Add hover effect
    canvas.onmousemove = (event) => {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const cellSize = 40;
        const j = Math.floor(x / cellSize);
        const i = Math.floor(y / cellSize);
        
        if (i >= 0 && i < state.numTracks && j >= 0 && j < state.numBars) {
            canvas.style.cursor = 'pointer';
        } else {
            canvas.style.cursor = 'default';
        }
    };
}

function handleCellClick(i, j) {
    if (state.mode === 'select') {
        if (!state.resampleMask[i] && !state.ignoreMask[i]) {
            state.selection[i][j] = !state.selection[i][j];
        }
    } else if (state.mode === 'resample') {
        state.resampleMask[i] = !state.resampleMask[i];
        if (state.resampleMask[i]) {
            state.ignoreMask[i] = false;
            for (let k = 0; k < state.numBars; k++) {
                state.selection[i][k] = true;
            }
        }
    } else if (state.mode === 'ignore') {
        state.ignoreMask[i] = !state.ignoreMask[i];
        if (state.ignoreMask[i]) {
            state.resampleMask[i] = false;
            for (let k = 0; k < state.numBars; k++) {
                state.selection[i][k] = false;
            }
        }
    } else if (state.mode === 'mask') {
        if (!state.resampleMask[i] && !state.ignoreMask[i]) {
            state.barMask[i][j] = !state.barMask[i][j];
        }
    }
    
    renderGrid();
}

function setMode(mode) {
    state.mode = mode;
    
    // Remove active class from all mode buttons
    document.getElementById('btn-select').classList.remove('active');
    document.getElementById('btn-resample').classList.remove('active');
    document.getElementById('btn-ignore').classList.remove('active');
    document.getElementById('btn-mask').classList.remove('active');
    
    // Add active class to the selected button
    document.getElementById(`btn-${mode}`).classList.add('active');
}

function clearAll() {
    state.selection = Array(state.numTracks).fill(null).map(() => Array(state.numBars).fill(false));
    state.resampleMask = Array(state.numTracks).fill(false);
    state.ignoreMask = Array(state.numTracks).fill(false);
    state.barMask = Array(state.numTracks).fill(null).map(() => Array(state.numBars).fill(false));
    renderGrid();
}

function generateSteps() {
    const modelDim = parseInt(document.getElementById('modelDim').value);
    const tracksPerStep = parseInt(document.getElementById('tracksPerStep').value);
    const barsPerStep = parseInt(document.getElementById('barsPerStep').value);
    const shuffle = document.getElementById('shuffle').checked;
    const autoMask = document.getElementById('autoMask').checked;
    
    state.steps = findSteps(
        state.selection,
        state.barMask,
        state.resampleMask,
        state.ignoreMask,
        { modelDim, tracksPerStep, barsPerStep, shuffle }
    );
    
    if (autoMask) {
        applyAutoMask();
    }
    
    document.getElementById('visualizationSection').classList.remove('hidden');
    document.getElementById('stepSlider').max = state.steps.length;
    document.getElementById('totalSteps').textContent = state.steps.length;
    state.currentStep = 0;
    updateVisualization();
}

function applyAutoMask() {
    const generated = Array(state.numTracks).fill(null).map(() => Array(state.numBars).fill(false));
    
    state.steps.forEach(step => {
        // Update mask for this step
        const newMask = Array(state.numTracks).fill(null).map(() => Array(state.numBars).fill(false));
        
        for (let i = 0; i < state.numTracks; i++) {
            for (let j = step.start; j < step.end; j++) {
                if (state.selection[i][j] && !generated[i][j] && !step.step[i][j]) {
                    newMask[i][j] = true;
                }
            }
        }
        
        step.autoMask = newMask;
        
        // Mark generated bars
        for (let i = 0; i < state.numTracks; i++) {
            for (let j = 0; j < state.numBars; j++) {
                if (step.step[i][j]) {
                    generated[i][j] = true;
                }
            }
        }
    });
}

function findSteps(selection, barMask, resampleMask, ignoreMask, param) {
    const steps = [];
    const generated = Array(state.numTracks).fill(null).map(() => Array(state.numBars).fill(false));
    
    // Autoregressive steps
    findStepsInner(steps, selection, resampleMask, ignoreMask, barMask, true, generated, param);
    
    // Non-autoregressive steps
    findStepsInner(steps, selection, resampleMask, ignoreMask, barMask, false, generated, param);
    
    return steps;
}

function findStepsInner(steps, selection, resampleMask, ignoreMask, preCondition, autoregressive, generated, param) {
    const { modelDim, tracksPerStep, barsPerStep, shuffle } = param;
    const nt = state.numTracks;
    const nb = state.numBars;
    
    const numContext = autoregressive ? modelDim - barsPerStep : Math.floor((modelDim - barsPerStep) / 2);
    
    for (let i = 0; i < nt; i += tracksPerStep) {
        for (let j = 0; j < nb; j += barsPerStep) {
            const numTracks = Math.min(tracksPerStep, nt - i);
            
            const step = Array(nt).fill(null).map(() => Array(nb).fill(false));
            const context = Array(nt).fill(null).map(() => Array(nb).fill(false));
            const mask = Array(nt).fill(null).map(() => Array(nb).fill(false));
            
            let start, end;
            
            if (autoregressive) {
                const rightOffset = Math.max((j + modelDim) - nb, 0);
                const t = Math.min(j, nb - modelDim);
                start = t;
                end = t + modelDim;
                
                const kernelStart = (j > 0 ? 1 : 0) * (numContext + rightOffset);
                
                for (let ti = i; ti < i + numTracks; ti++) {
                    for (let tj = start + kernelStart; tj < end; tj++) {
                        if (resampleMask[ti] && selection[ti][tj] && !generated[ti][tj]) {
                            step[ti][tj] = true;
                        }
                    }
                }
            } else {
                const t = Math.max(0, Math.min(j - numContext, nb - modelDim));
                start = t;
                end = t + modelDim;
                
                for (let ti = i; ti < i + numTracks; ti++) {
                    for (let tj = j; tj < Math.min(j + barsPerStep, end); tj++) {
                        if (!resampleMask[ti] && selection[ti][tj] && !generated[ti][tj]) {
                            step[ti][tj] = true;
                        }
                    }
                }
            }
            
            // Set context
            for (let ti = 0; ti < nt; ti++) {
                for (let tj = start; tj < end; tj++) {
                    if (!ignoreMask[ti] && !step[ti][tj]) {
                        context[ti][tj] = true;
                    }
                }
            }
            
            // Set mask
            for (let ti = 0; ti < nt; ti++) {
                for (let tj = start; tj < end; tj++) {
                    if (!step[ti][tj]) {
                        if (context[ti][tj] && preCondition[ti][tj] && selection[ti][tj] && !generated[ti][tj]) {
                            mask[ti][tj] = true;
                        }
                        if (preCondition[ti][tj] && !selection[ti][tj]) {
                            mask[ti][tj] = true;
                        }
                    }
                }
            }
            
            // Check if step has any generation
            let hasGeneration = false;
            for (let ti = 0; ti < nt; ti++) {
                for (let tj = 0; tj < nb; tj++) {
                    if (step[ti][tj]) {
                        hasGeneration = true;
                        generated[ti][tj] = true;
                    }
                }
            }
            
            if (hasGeneration) {
                steps.push({ start, end, step, context, mask });
            }
        }
    }
}

function updateVisualization() {
    const slider = document.getElementById('stepSlider');
    const stepIndex = parseInt(slider.value);
    state.currentStep = stepIndex;
    
    const canvas = document.getElementById('stepCanvas');
    const ctx = canvas.getContext('2d');
    
    const cellSize = 40;
    canvas.width = state.numBars * cellSize;
    canvas.height = state.numTracks * cellSize;
    
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const bgColor = isDark ? '#1c1c1e' : '#ffffff';
    const darkGridColor = isDark ? '#f5f5f7' : '#1d1d1f';
    
    // Clear canvas
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (stepIndex === 0) {
        // Overview
        document.getElementById('vizGridTitle').textContent = 'Overview';
        updateLegend('overview');
        renderOverview(ctx, cellSize);
        document.getElementById('stepInfo').textContent = 'Overview';
        document.getElementById('currentBars').textContent = '-';
        document.getElementById('barRange').textContent = '-';
    } else {
        // Specific step
        document.getElementById('vizGridTitle').textContent = 'Step Details';
        updateLegend('step');
        const step = state.steps[stepIndex - 1];
        renderStep(ctx, step, cellSize);
        
        // Get model parameters for grid rendering
        const tracksPerStep = parseInt(document.getElementById('tracksPerStep').value);
        const barsPerStep = parseInt(document.getElementById('barsPerStep').value);
        
        // Draw step decomposition grid (darker lines)
        ctx.strokeStyle = darkGridColor;
        ctx.lineWidth = 2;
        
        // Vertical lines for bars per step
        for (let j = 0; j <= state.numBars; j += barsPerStep) {
            ctx.beginPath();
            ctx.moveTo(j * cellSize, 0);
            ctx.lineTo(j * cellSize, canvas.height);
            ctx.stroke();
        }
        
        // Horizontal lines for tracks per step
        for (let i = 0; i <= state.numTracks; i += tracksPerStep) {
            ctx.beginPath();
            ctx.moveTo(0, i * cellSize);
            ctx.lineTo(canvas.width, i * cellSize);
            ctx.stroke();
        }
        
        // Highlight the current step window with a bold outline
        ctx.strokeStyle = '#0a84ff';
        ctx.lineWidth = 3;
        ctx.strokeRect(
            step.start * cellSize, 
            0, 
            (step.end - step.start) * cellSize, 
            canvas.height
        );
        
        let barsCount = 0;
        for (let i = 0; i < state.numTracks; i++) {
            for (let j = 0; j < state.numBars; j++) {
                if (step.step[i][j]) barsCount++;
            }
        }
        
        document.getElementById('stepInfo').textContent = `Step ${stepIndex} of ${state.steps.length}`;
        document.getElementById('currentBars').textContent = barsCount;
        document.getElementById('barRange').textContent = `${step.start}-${step.end}`;
    }
}

function updateLegend(type) {
    const legendContainer = document.getElementById('vizLegend');
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const theme = isDark ? COLORS.dark : COLORS.light;
    
    if (type === 'overview') {
        legendContainer.innerHTML = `
            <div class="legend-item">
                <div class="legend-color" style="background: ${theme.empty}; border: 1px solid #d2d2d7;"></div>
                <span>Empty</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: ${theme.selected};"></div>
                <span>Selected</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: ${theme.resample};"></div>
                <span>Resample</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: ${theme.ignore};"></div>
                <span>Ignore</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: ${theme.mask};"></div>
                <span>Mask</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: repeating-linear-gradient(45deg, ${theme.selected}, ${theme.selected} 2px, ${theme.mask} 2px, ${theme.mask} 4px);"></div>
                <span>Selected+Masked</span>
            </div>
            <span class="legend-help">?
                <span class="tooltip">
                    <div class="tooltip-content">
                        <div class="tooltip-item">
                            <div class="tooltip-color" style="background: ${theme.empty}; border: 1px solid #d2d2d7;"></div>
                            <span>No action for these bars</span>
                        </div>
                        <div class="tooltip-item">
                            <div class="tooltip-color" style="background: ${theme.selected};"></div>
                            <span>Bars selected for infilling</span>
                        </div>
                        <div class="tooltip-item">
                            <div class="tooltip-color" style="background: ${theme.resample};"></div>
                            <span>Autoregressive track processing</span>
                        </div>
                        <div class="tooltip-item">
                            <div class="tooltip-color" style="background: ${theme.ignore};"></div>
                            <span>Tracks excluded from processing</span>
                        </div>
                        <div class="tooltip-item">
                            <div class="tooltip-color" style="background: ${theme.mask};"></div>
                            <span>Bars masked from context</span>
                        </div>
                        <div class="tooltip-item">
                            <div class="tooltip-color" style="background: repeating-linear-gradient(45deg, ${theme.selected}, ${theme.selected} 2px, ${theme.mask} 2px, ${theme.mask} 4px);"></div>
                            <span>Selected & masked together</span>
                        </div>
                    </div>
                </span>
            </span>
        `;
    } else {
        legendContainer.innerHTML = `
            <div class="legend-item">
                <div class="legend-color" style="background: ${theme.empty}; border: 1px solid #d2d2d7;"></div>
                <span>Empty</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: ${theme.context};"></div>
                <span>Context</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: ${theme.generate};"></div>
                <span>Generate</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: ${theme.stepMask};"></div>
                <span>Masked</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: ${theme.ignore};"></div>
                <span>Ignored</span>
            </div>
            <span class="legend-help">?
                <span class="tooltip">
                    <div class="tooltip-content">
                        <div class="tooltip-item">
                            <div class="tooltip-color" style="background: ${theme.empty}; border: 1px solid #d2d2d7;"></div>
                            <span>Outside current step window</span>
                        </div>
                        <div class="tooltip-item">
                            <div class="tooltip-color" style="background: ${theme.context};"></div>
                            <span>Context provided to the model</span>
                        </div>
                        <div class="tooltip-item">
                            <div class="tooltip-color" style="background: ${theme.generate};"></div>
                            <span>Bars being generated in this step</span>
                        </div>
                        <div class="tooltip-item">
                            <div class="tooltip-color" style="background: ${theme.stepMask};"></div>
                            <span>Bars hidden from model context</span>
                        </div>
                        <div class="tooltip-item">
                            <div class="tooltip-color" style="background: ${theme.ignore};"></div>
                            <span>Tracks not used in this step</span>
                        </div>
                    </div>
                </span>
            </span>
        `;
    }

    setupTooltips();
}

function renderOverview(ctx, cellSize) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const theme = isDark ? COLORS.dark : COLORS.light;
    
    const gridColor = isDark ? '#48484a' : '#e8e8ed';
    const darkGridColor = isDark ? '#f5f5f7' : '#1d1d1f';

    const diagonalPattern = createDiagonalStripePattern(ctx, cellSize, theme);
    
    // Draw cells
    for (let i = 0; i < state.numTracks; i++) {
        for (let j = 0; j < state.numBars; j++) {
            const x = j * cellSize;
            const y = i * cellSize;
            
            let color = theme.empty;
            let isSelectedMasked = false;
            let isMasked = false;
            
            if (state.ignoreMask[i]) {
                color = theme.ignore;
            } else if (state.resampleMask[i]) {
                color = theme.resample;
            } else if (state.barMask[i][j] && state.selection[i][j]) {
                isSelectedMasked = true;
            } else if (state.barMask[i][j]) {
                isMasked = true;
            } else if (state.selection[i][j]) {
                color = theme.selected;
            }
            
            if (isSelectedMasked) {
                // Selected color with diagonal stripes
                //ctx.fillStyle = theme.selected;
                //ctx.fillRect(x, y, cellSize, cellSize);
                
                //ctx.fillStyle = theme.mask;
                //for (let stripe = -cellSize; stripe < cellSize * 2; stripe += 8) {
                //    ctx.fillRect(x + stripe, y, 4, cellSize);
                //}

                ctx.fillStyle = diagonalPattern; // cached result from above
                ctx.fillRect(x, y, cellSize, cellSize);
            } else if (isMasked) {
                // Solid mask color
                ctx.fillStyle = theme.mask;
                ctx.fillRect(x, y, cellSize, cellSize);
            } else {
                ctx.fillStyle = color;
                ctx.fillRect(x, y, cellSize, cellSize);
            }
        }
    }
    
    // Draw light grid lines for individual bars
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    
    // Vertical lines (bars)
    for (let j = 0; j <= state.numBars; j++) {
        ctx.beginPath();
        ctx.moveTo(j * cellSize, 0);
        ctx.lineTo(j * cellSize, state.numTracks * cellSize);
        ctx.stroke();
    }
    
    // Horizontal lines (tracks)
    for (let i = 0; i <= state.numTracks; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * cellSize);
        ctx.lineTo(state.numBars * cellSize, i * cellSize);
        ctx.stroke();
    }
    
    // Draw step decomposition grid (darker lines) for overview
    const tracksPerStep = parseInt(document.getElementById('tracksPerStep').value);
    const barsPerStep = parseInt(document.getElementById('barsPerStep').value);
    
    ctx.strokeStyle = darkGridColor;
    ctx.lineWidth = 2;
    
    // Vertical lines for bars per step
    for (let j = 0; j <= state.numBars; j += barsPerStep) {
        ctx.beginPath();
        ctx.moveTo(j * cellSize, 0);
        ctx.lineTo(j * cellSize, state.numTracks * cellSize);
        ctx.stroke();
    }
    
    // Horizontal lines for tracks per step
    for (let i = 0; i <= state.numTracks; i += tracksPerStep) {
        ctx.beginPath();
        ctx.moveTo(0, i * cellSize);
        ctx.lineTo(state.numBars * cellSize, i * cellSize);
        ctx.stroke();
    }
}

function renderStep(ctx, step, cellSize) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const theme = isDark ? COLORS.dark : COLORS.light;
    
    const gridColor = isDark ? '#48484a' : '#e8e8ed';
    
    const autoMask = step.autoMask || Array(state.numTracks).fill(null).map(() => Array(state.numBars).fill(false));
    
    // Draw cells
    for (let i = 0; i < state.numTracks; i++) {
        for (let j = 0; j < state.numBars; j++) {
            const x = j * cellSize;
            const y = i * cellSize;
            
            let color = theme.empty;
            
            // Check if track is ignored
            if (state.ignoreMask[i]) {
                color = theme.ignore;
            } else if (step.step[i][j]) {
                color = theme.generate;
            } else if (step.mask[i][j] || autoMask[i][j]) {
                color = theme.stepMask;
            } else if (step.context[i][j]) {
                color = theme.context;
            }
            
            ctx.fillStyle = color;
            ctx.fillRect(x, y, cellSize, cellSize);
        }
    }
    
    // Draw light grid lines for individual bars
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    
    // Vertical lines (bars)
    for (let j = 0; j <= state.numBars; j++) {
        ctx.beginPath();
        ctx.moveTo(j * cellSize, 0);
        ctx.lineTo(j * cellSize, state.numTracks * cellSize);
        ctx.stroke();
    }
    
    // Horizontal lines (tracks)
    for (let i = 0; i <= state.numTracks; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * cellSize);
        ctx.lineTo(state.numBars * cellSize, i * cellSize);
        ctx.stroke();
    }
}

function updateStep() {
    updateVisualization();
}

function previousStep() {
    const slider = document.getElementById('stepSlider');
    if (slider.value > 0) {
        slider.value = parseInt(slider.value) - 1;
        updateVisualization();
    }
}

function nextStep() {
    const slider = document.getElementById('stepSlider');
    if (slider.value < slider.max) {
        slider.value = parseInt(slider.value) + 1;
        updateVisualization();
    }
}

// Update selection grid legend colors
function updateSelectionLegend() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const theme = isDark ? GLOBAL_COLORS.dark : GLOBAL_COLORS.light;
    
    // Update legend items
    const legendItems = document.querySelectorAll('.grid-container .legend .legend-color');
    if (legendItems.length >= 4) {
        legendItems[0].style.background = theme.selected;
        legendItems[1].style.background = theme.resample;
        legendItems[2].style.background = theme.ignore;
        legendItems[3].style.background = theme.mask;
        legendItems[4].style.background = `repeating-linear-gradient(45deg, ${theme.selected}, ${theme.selected} 2px, ${theme.mask} 2px, ${theme.mask} 4px)`;
    }
    
    // Update tooltip colors
    const tooltipItems = document.querySelectorAll('#selectionTooltip .tooltip-color');
    if (tooltipItems.length >= 5) {
        tooltipItems[0].style.background = theme.selected;
        tooltipItems[1].style.background = theme.resample;
        tooltipItems[2].style.background = theme.ignore;
        tooltipItems[3].style.background = theme.mask;
        tooltipItems[4].style.background = `repeating-linear-gradient(45deg, ${theme.selected}, ${theme.selected} 2px, ${theme.mask} 2px, ${theme.mask} 4px)`;
    }
}

// Dynamic tooltip positioning
function positionTooltip(tooltip, trigger) {
    const tooltipRect = tooltip.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 10; // Margin from viewport edge
    
    let position = 'top'; // Default position
    let top, left;
    
    // Calculate potential positions
    const positions = {
        top: {
            top: triggerRect.top - tooltipRect.height - margin,
            left: triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2),
            fits: triggerRect.top - tooltipRect.height - margin > 0
        },
        bottom: {
            top: triggerRect.bottom + margin,
            left: triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2),
            fits: triggerRect.bottom + tooltipRect.height + margin < viewportHeight
        },
        left: {
            top: triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2),
            left: triggerRect.left - tooltipRect.width - margin,
            fits: triggerRect.left - tooltipRect.width - margin > 0
        },
        right: {
            top: triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2),
            left: triggerRect.right + margin,
            fits: triggerRect.right + tooltipRect.width + margin < viewportWidth
        }
    };
    
    // Choose the best position (prioritize top, then bottom, then left, then right)
    const preferredOrder = ['top', 'bottom', 'left', 'right'];
    for (const pos of preferredOrder) {
        if (positions[pos].fits) {
            position = pos;
            top = positions[pos].top;
            left = positions[pos].left;
            break;
        }
    }
    
    // If no position fits perfectly, use top and adjust
    if (top === undefined) {
        position = 'top';
        top = positions.top.top;
        left = positions.top.left;
    }
    
    // Ensure tooltip doesn't overflow horizontally
    if (left < margin) {
        left = margin;
    } else if (left + tooltipRect.width > viewportWidth - margin) {
        left = viewportWidth - tooltipRect.width - margin;
    }
    
    // Ensure tooltip doesn't overflow vertically
    if (top < margin) {
        top = margin;
    } else if (top + tooltipRect.height > viewportHeight - margin) {
        top = viewportHeight - tooltipRect.height - margin;
    }
    
    // Apply position
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
    
    // Remove all position classes and add the current one
    tooltip.classList.remove('position-top', 'position-bottom', 'position-left', 'position-right');
    tooltip.classList.add(`position-${position}`);
}

// Setup tooltip positioning on hover
function setupTooltips() {
    const helpButtons = document.querySelectorAll('.legend-help');
    
    helpButtons.forEach(button => {
        button.addEventListener('mouseenter', function() {
            const tooltip = this.querySelector('.tooltip');
            if (tooltip) {
                // Small delay to ensure tooltip is rendered before positioning
                setTimeout(() => {
                    positionTooltip(tooltip, this);
                }, 10);
            }
        });
    });
}

// Initialize on load
initializeTheme();
initializeGrid();
setupTooltips();
updateSelectionLegend();