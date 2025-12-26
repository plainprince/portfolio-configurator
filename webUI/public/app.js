let currentVariation = null;
let currentConfig = null;
let saveTimeout = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadVariations();
    setupDownloadButton();
    // Auto-select variation1
    const variations = await fetch('/api/variations').then(r => r.json());
    if (variations.length > 0) {
        await loadVariation(variations[0]);
    }
});

async function loadVariations() {
    try {
        const response = await fetch('/api/variations');
        const variations = await response.json();
        
        const buttonsContainer = document.getElementById('variation-buttons');
        buttonsContainer.innerHTML = '';
        
        variations.forEach((variation, index) => {
            const btn = document.createElement('button');
            btn.className = 'variation-btn';
            btn.textContent = (index + 1).toString();
            btn.dataset.variation = variation;
            btn.addEventListener('click', () => loadVariation(variation));
            buttonsContainer.appendChild(btn);
        });
    } catch (error) {
        console.error('Failed to load variations:', error);
    }
}

async function loadVariation(variationName) {
    currentVariation = variationName;
    
    // Update active button
    document.querySelectorAll('.variation-btn').forEach(btn => {
        if (btn.dataset.variation === variationName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Load config
    try {
        const response = await fetch(`/api/config/${variationName}`);
        currentConfig = await response.json();
        renderConfigEditor(currentConfig);
    } catch (error) {
        console.error('Failed to load config:', error);
        document.getElementById('config-editor').innerHTML = 
            '<p class="placeholder">Failed to load configuration</p>';
    }
    
    // Load preview
    const previewFrame = document.getElementById('preview-frame');
    previewFrame.src = `/variation/${variationName}/index.html`;
}

function setupDownloadButton() {
    const downloadBtn = document.getElementById('download-btn');
    downloadBtn.addEventListener('click', async () => {
        if (!currentVariation) {
            alert('Please select a variation first');
            return;
        }
        
        downloadBtn.disabled = true;
        downloadBtn.textContent = 'Zipping...';
        
        try {
            const response = await fetch(`/api/download/${currentVariation}`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Download failed' }));
                throw new Error(errorData.error || 'Download failed');
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'portfolio.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download error:', error);
            alert(`Failed to download portfolio: ${error.message}`);
        } finally {
            downloadBtn.disabled = false;
            downloadBtn.textContent = 'Download ZIP';
        }
    });
}

function isDateString(str) {
    if (typeof str !== 'string') return false;
    // Check for common date formats: DD.MM.YYYY, YYYY-MM-DD, MM/DD/YYYY, etc.
    const datePatterns = [
        /^\d{2}\.\d{2}\.\d{4}$/,  // DD.MM.YYYY
        /^\d{4}-\d{2}-\d{2}$/,     // YYYY-MM-DD
        /^\d{2}\/\d{2}\/\d{4}$/,   // MM/DD/YYYY
        /^\d{4}\/\d{2}\/\d{2}$/    // YYYY/MM/DD
    ];
    return datePatterns.some(pattern => pattern.test(str));
}

function parseDateToInput(str) {
    // Convert DD.MM.YYYY to YYYY-MM-DD
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(str)) {
        const [day, month, year] = str.split('.');
        return `${year}-${month}-${day}`;
    }
    // Already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        return str;
    }
    // Try to parse and convert
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
    }
    return str;
}

function formatDateFromInput(str) {
    // Convert YYYY-MM-DD back to DD.MM.YYYY if original was in that format
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        const [year, month, day] = str.split('-');
        return `${day}.${month}.${year}`;
    }
    return str;
}

function renderConfigEditor(config) {
    const editor = document.getElementById('config-editor');
    editor.innerHTML = '';
    
    // Render each field
    Object.keys(config).forEach(key => {
        const value = config[key];
        
        if (Array.isArray(value)) {
            renderArrayField(editor, key, value, config);
        } else if (typeof value === 'object' && value !== null) {
            renderObjectField(editor, key, value, config);
        } else {
            renderSimpleField(editor, key, value, config);
        }
    });
}

function renderSimpleField(container, key, value, config) {
    const group = document.createElement('div');
    group.className = 'form-group';
    
    const label = document.createElement('label');
    label.className = 'form-label';
    label.textContent = key;
    label.setAttribute('for', `field-${key}`);
    
    let input;
    const isDate = isDateString(value);
    
    if (isDate) {
        input = document.createElement('input');
        input.className = 'form-input';
        input.type = 'date';
        input.value = parseDateToInput(value);
        input.addEventListener('change', (e) => {
            config[key] = formatDateFromInput(e.target.value);
            autoSave();
        });
    } else if (typeof value === 'string' && value.length > 100) {
        input = document.createElement('textarea');
        input.className = 'form-textarea';
        input.value = value;
        input.addEventListener('input', (e) => {
            config[key] = e.target.value;
            autoSave();
        });
    } else {
        input = document.createElement('input');
        input.className = 'form-input';
        input.type = typeof value === 'number' ? 'number' : 'text';
        input.value = value;
        input.addEventListener('input', (e) => {
            if (input.type === 'number') {
                config[key] = parseFloat(e.target.value) || 0;
            } else {
                config[key] = e.target.value;
            }
            autoSave();
        });
    }
    
    input.id = `field-${key}`;
    
    group.appendChild(label);
    group.appendChild(input);
    container.appendChild(group);
}

function renderArrayField(container, key, array, config) {
    const group = document.createElement('div');
    group.className = 'form-group';
    
    const label = document.createElement('label');
    label.className = 'form-label array-header';
    label.textContent = `${key} (${array.length} items):`;
    group.appendChild(label);
    
    // Check if it's an array of strings or objects
    if (array.length > 0 && typeof array[0] === 'object') {
        // Array of objects (e.g., skills)
        array.forEach((item, index) => {
            const itemDiv = renderObjectArrayItem(container, key, item, index, config);
            group.appendChild(itemDiv);
        });
        
        const addBtn = document.createElement('button');
        addBtn.className = 'btn-add';
        addBtn.textContent = `+ Add ${key.slice(0, -1)}`;
        addBtn.addEventListener('click', () => {
            const newItem = createDefaultObjectItem(array[0]);
            config[key].push(newItem);
            renderConfigEditor(config);
            autoSave();
        });
        group.appendChild(addBtn);
    } else {
        // Array of strings (e.g., aboutMe)
        array.forEach((item, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'form-array-item';
            
            const header = document.createElement('div');
            header.className = 'form-array-item-header';
            
            const title = document.createElement('span');
            title.className = 'array-item-title';
            title.textContent = index.toString();
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn-remove';
            removeBtn.textContent = 'Remove';
            removeBtn.addEventListener('click', () => {
                config[key].splice(index, 1);
                renderConfigEditor(config);
                autoSave();
            });
            
            header.appendChild(title);
            header.appendChild(removeBtn);
            itemDiv.appendChild(header);
            
            const textarea = document.createElement('textarea');
            textarea.className = 'form-textarea';
            textarea.value = item;
            textarea.addEventListener('input', (e) => {
                config[key][index] = e.target.value;
                autoSave();
            });
            
            itemDiv.appendChild(textarea);
            group.appendChild(itemDiv);
        });
        
        const addBtn = document.createElement('button');
        addBtn.className = 'btn-add';
        addBtn.textContent = `+ Add ${key.slice(0, -1)}`;
        addBtn.addEventListener('click', () => {
            config[key].push('');
            renderConfigEditor(config);
            autoSave();
        });
        group.appendChild(addBtn);
    }
    
    container.appendChild(group);
}

function renderObjectArrayItem(container, key, item, index, config) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'form-array-item';
    
    const header = document.createElement('div');
    header.className = 'form-array-item-header';
    
    const title = document.createElement('span');
    title.className = 'array-item-title';
    title.textContent = index.toString();
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-remove';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
        config[key].splice(index, 1);
        renderConfigEditor(config);
        autoSave();
    });
    
    header.appendChild(title);
    header.appendChild(removeBtn);
    itemDiv.appendChild(header);
    
    // Render object fields
    Object.keys(item).forEach(subKey => {
        const subGroup = document.createElement('div');
        subGroup.style.marginBottom = '0.5rem';
        
        const subLabel = document.createElement('label');
        subLabel.className = 'form-label';
        subLabel.textContent = subKey;
        subLabel.style.fontSize = '0.85rem';
        
        let input;
        if (subKey === 'color') {
            input = document.createElement('input');
            input.className = 'form-input';
            input.type = 'color';
            input.value = item[subKey] || '#000000';
            input.addEventListener('input', (e) => {
                config[key][index][subKey] = e.target.value;
                autoSave();
            });
        } else if (subKey === 'desc' || (typeof item[subKey] === 'string' && item[subKey].length > 50)) {
            input = document.createElement('textarea');
            input.className = 'form-textarea';
            input.style.minHeight = '60px';
            input.value = item[subKey];
            input.addEventListener('input', (e) => {
                config[key][index][subKey] = e.target.value;
                autoSave();
            });
        } else {
            input = document.createElement('input');
            input.className = 'form-input';
            input.type = 'text';
            input.value = item[subKey];
            input.addEventListener('input', (e) => {
                config[key][index][subKey] = e.target.value;
                autoSave();
            });
        }
        
        subGroup.appendChild(subLabel);
        subGroup.appendChild(input);
        itemDiv.appendChild(subGroup);
    });
    
    return itemDiv;
}

function renderObjectField(container, key, obj, config) {
    const group = document.createElement('div');
    group.className = 'form-group';
    
    const label = document.createElement('label');
    label.className = 'form-label';
    label.textContent = key;
    group.appendChild(label);
    
    Object.keys(obj).forEach(subKey => {
        renderSimpleField(group, subKey, obj[subKey], obj);
    });
    
    container.appendChild(group);
}

function createDefaultObjectItem(template) {
    const newItem = {};
    Object.keys(template).forEach(key => {
        if (typeof template[key] === 'string') {
            newItem[key] = '';
        } else if (typeof template[key] === 'number') {
            newItem[key] = 0;
        } else {
            newItem[key] = template[key];
        }
    });
    return newItem;
}

function autoSave() {
    if (!currentVariation || !currentConfig) {
        return;
    }
    
    // Clear existing timeout
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }
    
    // Set new timeout to save after 500ms of no changes
    saveTimeout = setTimeout(async () => {
        try {
            const response = await fetch(`/api/config/${currentVariation}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(currentConfig, null, 4),
            });
            
            if (response.ok) {
                // Reload preview to show changes
                const previewFrame = document.getElementById('preview-frame');
                previewFrame.src = previewFrame.src;
            }
        } catch (error) {
            console.error('Failed to save config:', error);
        }
    }, 500);
}
