// Drake AI AutoSplice - sidebar navigation + robust LAS upload handlers
(function () {
  function $(id) { return document.getElementById(id); }
  function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function getProjectName() {
    const el = $('project-name-select') || $('project-name-import') || document.querySelector('input[name="project_name"]');
    return el && el.value ? el.value.trim() : '';
  }

  function bytesToSize(bytes) {
    if (!bytes && bytes !== 0) return '-';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
    return `${(bytes / Math.pow(1024, i)).toFixed(i ? 2 : 0)} ${sizes[i]}`;
  }

  function setMessage(el, message, type) {
    if (!el) return;
    el.style.display = message ? 'block' : 'none';
    el.innerHTML = message || '';
    el.style.borderColor = type === 'error' ? 'rgba(239,68,68,.45)' : type === 'success' ? 'rgba(25,195,125,.45)' : 'rgba(33,132,255,.28)';
    el.style.background = type === 'error' ? 'rgba(239,68,68,.12)' : type === 'success' ? 'rgba(25,195,125,.12)' : 'rgba(33,132,255,.1)';
    el.style.color = type === 'error' ? '#ff9a9a' : type === 'success' ? '#72f0b6' : '#cfe1f8';
  }

  function showFolderStatus(message, isError) {
    const status = $('import-status');
    if (status) {
      status.textContent = message || '';
      status.style.color = isError ? '#ff9a9a' : '#8fa4c0';
    }
  }

  function setFolderBusy(isBusy) {
    const spinner = $('import-spinner');
    const btn = $('import-wells-btn');
    if (spinner) {
      spinner.classList.toggle('hidden', !isBusy);
      spinner.style.display = isBusy ? 'inline-block' : 'none';
    }
    if (btn && isBusy) btn.disabled = true;
  }

  function safeWellNameFromPath(path) {
    const first = (path || '').replace(/\\/g, '/').split('/')[0] || 'Imported_Well';
    return first.replace(/\.las$/i, '').replace(/[<>:"/\\|?*]+/g, '_').trim() || 'Imported_Well';
  }

  function fileBaseName(filename) {
    return (filename || 'Imported_Well').replace(/\.las$/i, '').replace(/[<>:"/\\|?*]+/g, '_').trim() || 'Imported_Well';
  }

  async function createWell(projectName, wellName) {
    const res = await fetch(`/project/${encodeURIComponent(projectName)}/create_well`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: `well_name=${encodeURIComponent(wellName)}`
    });
    let data = {};
    try { data = await res.json(); } catch (_) { data = { message: await res.text() }; }
    if (!res.ok && !(data.message || '').toLowerCase().includes('already exists')) {
      throw new Error(data.message || `Could not create well ${wellName}`);
    }
    return data;
  }

  async function uploadLasFiles(projectName, wellName, files, onProgress) {
    const BATCH_SIZE = 20;
    let uploaded = 0;
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      const fd = new FormData();
      batch.forEach(file => fd.append('files[]', file, file.name));
      // Include extra fields for compatibility with older handlers.
      fd.append('project_name', projectName);
      fd.append('well_name', wellName);
      const res = await fetch(`/project/${encodeURIComponent(projectName)}/well/${encodeURIComponent(wellName)}/import_las`, {
        method: 'POST',
        body: fd
      });
      let data = {};
      try { data = await res.json(); } catch (_) { data = { message: await res.text() }; }
      if (!res.ok || data.success === false) {
        throw new Error(data.message || `Upload failed for ${wellName}`);
      }
      uploaded += batch.length;
      if (typeof onProgress === 'function') onProgress(uploaded, files.length, data);
    }
  }

  // Folder import state
  const selectedWellFiles = new Map();
  function addFilesForWell(wellName, files) {
    const lasFiles = Array.from(files || []).filter(f => f.name && f.name.toLowerCase().endsWith('.las'));
    if (!lasFiles.length) return 0;
    const existing = selectedWellFiles.get(wellName) || [];
    selectedWellFiles.set(wellName, existing.concat(lasFiles));
    return lasFiles.length;
  }
  function addFolderFiles(fileList) {
    let count = 0;
    Array.from(fileList || []).forEach(file => {
      if (!file.name || !file.name.toLowerCase().endsWith('.las')) return;
      const rel = file._relativePath || file.webkitRelativePath || file.name;
      const wellName = safeWellNameFromPath(rel);
      count += addFilesForWell(wellName, [file]);
    });
    return count;
  }

  function addStandaloneLasFiles(fileList) {
    let count = 0;
    Array.from(fileList || []).forEach(file => {
      if (!file.name || !file.name.toLowerCase().endsWith('.las')) return;
      const wellName = fileBaseName(file.name);
      count += addFilesForWell(wellName, [file]);
    });
    return count;
  }

  function readAllEntries(reader) {
    return new Promise((resolve, reject) => {
      const entries = [];
      const readBatch = () => {
        reader.readEntries(batch => {
          if (!batch.length) return resolve(entries);
          entries.push.apply(entries, batch);
          readBatch();
        }, reject);
      };
      readBatch();
    });
  }

  function fileFromEntry(entry, relativePath) {
    return new Promise(resolve => {
      entry.file(file => {
        try { Object.defineProperty(file, '_relativePath', { value: relativePath || file.name }); } catch (_) { file._relativePath = relativePath || file.name; }
        resolve([file]);
      }, () => resolve([]));
    });
  }

  async function filesFromEntry(entry, pathPrefix) {
    if (!entry) return [];
    const relativePath = pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name;
    if (entry.isFile) return fileFromEntry(entry, relativePath);
    if (!entry.isDirectory) return [];
    const entries = await readAllEntries(entry.createReader());
    const nested = await Promise.all(entries.map(child => filesFromEntry(child, relativePath)));
    return nested.flat();
  }

  async function filesFromDropEvent(event) {
    const items = Array.from((event.dataTransfer && event.dataTransfer.items) || []);
    const entries = items.map(item => item.webkitGetAsEntry && item.webkitGetAsEntry()).filter(Boolean);
    if (entries.length) {
      const nested = await Promise.all(entries.map(entry => filesFromEntry(entry, '')));
      return nested.flat();
    }
    return Array.from((event.dataTransfer && event.dataTransfer.files) || []);
  }
  function renderSelectedFolders() {
    const box = $('selected-folders');
    const btn = $('import-wells-btn');
    if (!box) return;
    box.innerHTML = '<h3>Selected LAS Files for Import:</h3>'; 
    const clearBtn = $('clear-selected-wells-btn');
    if (selectedWellFiles.size === 0) {
      box.insertAdjacentHTML('beforeend', '<p class="muted">No folders selected yet.</p>');
      if (btn) btn.disabled = true;
      if (clearBtn) clearBtn.disabled = true;
      return;
    }
    selectedWellFiles.forEach((files, well) => {
      const names = files.slice(0, 3).map(f => f.name).join(', ');
      const row = document.createElement('div');
      row.className = 'selected-folder-item';
      row.innerHTML = `<div><strong><i class="fas fa-folder" style="color:#4aa3ff"></i> ${well}</strong><div class="muted" style="font-size:13px;margin-top:4px;">${files.length} LAS file${files.length !== 1 ? 's' : ''}${names ? ': ' + names + (files.length > 3 ? '...' : '') : ''}</div></div><button type="button" class="btn btn-ghost remove-selected-well" data-well="${well}"><i class="fas fa-times"></i></button>`;
      box.appendChild(row);
    });
    if (btn) btn.disabled = false;
    if (clearBtn) clearBtn.disabled = false;
  }

  // Direct import state
  let directFiles = [];
  function selectedWellName() {
    const sel = $('well-select');
    return sel && sel.value ? sel.value.trim() : '';
  }
  function showImportLasForm() {
    const form = $('import-las-form');
    const info = $('selected-well-info');
    const well = selectedWellName();
    if (form) form.classList.toggle('hidden', !well);
    if (info) {
      if (well) {
        info.style.display = 'block';
        info.innerHTML = `<i class="fas fa-check-circle success"></i> Selected well: <strong>${well}</strong>`;
      } else {
        info.style.display = 'none';
        info.innerHTML = '';
      }
    }
    renderDirectTable();
  }
  function setDirectStatus(message, type) { setMessage($('direct-upload-status'), message, type); }
  function renderDirectTable() {
    const tbody = document.querySelector('#las-preview-table tbody');
    const btn = $('upload-las-btn');
    const clearDirectBtn = $('clear-direct-files-btn');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!directFiles.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="5" class="muted">No LAS files selected yet.</td></tr>';
    } else {
      directFiles.forEach((file, idx) => {
        const ext = (file.name.split('.').pop() || '').toUpperCase();
        const valid = file.name.toLowerCase().endsWith('.las') && file.size > 0;
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><strong>${file.name}</strong></td><td>${bytesToSize(file.size)}</td><td>${ext}</td><td><span class="badge" style="${valid ? '' : 'border-color:rgba(239,68,68,.45);background:rgba(239,68,68,.12);color:#ff9a9a;'}">${valid ? 'Ready to Upload' : 'Invalid File'}</span></td><td><button type="button" class="btn btn-ghost remove-direct-file" data-index="${idx}"><i class="fas fa-times"></i></button></td>`;
        tbody.appendChild(tr);
      });
    }
    if (btn) btn.disabled = !(selectedWellName() && directFiles.length && directFiles.every(f => f.name.toLowerCase().endsWith('.las') && f.size > 0));
    if (clearDirectBtn) clearDirectBtn.disabled = directFiles.length === 0;
  }
  function addDirectFiles(files) {
    const incoming = Array.from(files || []);
    const lasFiles = incoming.filter(f => f.name && f.name.toLowerCase().endsWith('.las'));
    if (incoming.length && !lasFiles.length) {
      setDirectStatus('<i class="fas fa-exclamation-circle"></i> Please select valid .las or .LAS files only.', 'error');
      return;
    }
    directFiles = directFiles.concat(lasFiles);
    if (lasFiles.length) setDirectStatus(`<i class="fas fa-check-circle"></i> ${lasFiles.length} LAS file(s) selected. Click Upload LAS Files to save them.`, 'success');
    renderDirectTable();
  }
  function markRows(statusText, type) {
    qsa('#las-preview-table tbody tr').forEach(tr => {
      const statusCell = tr.children[3];
      if (statusCell) {
        const color = type === 'error' ? '#ff9a9a' : type === 'success' ? '#72f0b6' : '#cfe1f8';
        const border = type === 'error' ? 'rgba(239,68,68,.45)' : type === 'success' ? 'rgba(25,195,125,.45)' : 'rgba(33,132,255,.45)';
        const bg = type === 'error' ? 'rgba(239,68,68,.12)' : type === 'success' ? 'rgba(25,195,125,.12)' : 'rgba(33,132,255,.12)';
        statusCell.innerHTML = `<span class="badge" style="border-color:${border};background:${bg};color:${color};">${statusText}</span>`;
      }
    });
  }

  function showSection(targetId) {
    if (targetId === 'home') { window.location.href = '/projects'; return; }
    const target = $(targetId);
    if (!target) return;
    const contentDivs = qsa('#content > div[id]');
    contentDivs.forEach(div => div.classList.toggle('hidden', div.id !== targetId));

    qsa('.menu-item').forEach(item => item.classList.remove('active'));
    qsa(`.menu-item[data-target="${targetId}"]`).forEach(item => item.classList.add('active'));

    // Parent active states should not create random double highlights; only relevant parents are highlighted.
    if (targetId === 'import-las' || targetId === 'import-wells') {
      qsa('.menu-item[data-group="las-upload"]').forEach(item => item.classList.add('active'));
    }
    if (targetId === 'existing-wells' || targetId === 'review-adjust' || targetId === 'spliced-results') {
      qsa('.menu-item[data-group="autosplice"]').forEach(item => item.classList.add('active'));
      if (targetId === 'existing-wells') qsa('.menu-item[data-target="existing-wells"]').forEach(item => item.classList.add('active'));
    }
  }

  window.viewSourceLasFile = function (projectName, wellName, fileName) {
    const url = `/get_las/${encodeURIComponent(projectName)}/${encodeURIComponent(wellName)}/${encodeURIComponent(fileName)}`;
    window.open(url, '_blank');
  };

  document.addEventListener('DOMContentLoaded', function () {
    qsa('.menu-item').forEach(item => {
      item.addEventListener('click', function () { showSection(this.dataset.target); });
    });
    qsa('.section-jump').forEach(btn => btn.addEventListener('click', function () { showSection(this.dataset.target); }));

    // Default to AutoSplice Generate on project open.
    showSection('existing-wells');

    const toggle = $('toggle-sidebar');
    const sidebar = $('sidebar');
    if (toggle && sidebar) toggle.addEventListener('click', () => sidebar.classList.toggle('collapsed'));

    // Folder import handlers.
    const folderPicker = $('folder-picker');
    const standaloneLasPicker = $('standalone-las-picker');
    const selectFolderBtn = $('select-folder-btn');
    const selectStandaloneLasBtn = $('select-standalone-las-btn');
    const dropZone = $('drop-zone');
    if (selectFolderBtn && folderPicker) {
      selectFolderBtn.addEventListener('click', () => folderPicker.click());
      folderPicker.addEventListener('change', () => {
        const count = addFolderFiles(folderPicker.files);
        renderSelectedFolders();
        showFolderStatus(count ? `${count} LAS file(s) selected from folder.` : 'No LAS files found in selected folder.', !count);
        folderPicker.value = '';
      });
    }
    if (selectStandaloneLasBtn && standaloneLasPicker) {
      selectStandaloneLasBtn.addEventListener('click', () => standaloneLasPicker.click());
      standaloneLasPicker.addEventListener('change', () => {
        const count = addStandaloneLasFiles(standaloneLasPicker.files);
        renderSelectedFolders();
        showFolderStatus(count ? `${count} LAS file(s) selected. Each file will be imported under a well named from the file.` : 'No valid .las files selected.', !count);
        standaloneLasPicker.value = '';
      });
    }
    if (dropZone) {
      ['dragenter', 'dragover'].forEach(evt => dropZone.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); dropZone.classList.add('drag-over'); }));
      ['dragleave', 'drop'].forEach(evt => dropZone.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); dropZone.classList.remove('drag-over'); }));
      dropZone.addEventListener('drop', async e => {
        const droppedFiles = await filesFromDropEvent(e);
        let count = addFolderFiles(droppedFiles);
        if (!count) count = addStandaloneLasFiles(droppedFiles);
        renderSelectedFolders();
        showFolderStatus(count ? `${count} LAS file(s) selected.` : 'No LAS files found. Drop a LAS file or a folder containing .las files.', !count);
      });
    }
    const importWellsForm = $('import-wells-form');
    if (importWellsForm) {
      importWellsForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const projectName = getProjectName();
        if (!projectName) return alert('Project name not found.');
        if (selectedWellFiles.size === 0) return alert('Please select a folder first.');
        try {
          setFolderBusy(true);
          let done = 0;
          const total = selectedWellFiles.size;
          for (const [wellName, files] of selectedWellFiles.entries()) {
            done += 1;
            showFolderStatus(`[${done}/${total}] Creating well ${wellName}...`, false);
            await createWell(projectName, wellName);
            showFolderStatus(`[${done}/${total}] Uploading ${files.length} LAS file(s) to ${wellName}...`, false);
            await uploadLasFiles(projectName, wellName, files);
          }
          showFolderStatus('LAS import completed successfully. Reloading...', false);
          setTimeout(() => window.location.reload(), 900);
        } catch (err) {
          console.error(err);
          showFolderStatus('Upload failed: ' + err.message, true);
          const btn = $('import-wells-btn');
          if (btn) btn.disabled = false;
        } finally {
          setFolderBusy(false);
        }
      });
    }

    const clearSelectedWellsBtn = $('clear-selected-wells-btn');
    if (clearSelectedWellsBtn) {
      clearSelectedWellsBtn.addEventListener('click', function () {
        selectedWellFiles.clear();
        renderSelectedFolders();
        showFolderStatus('Selected LAS files cleared.', false);
      });
    }

    // Direct LAS upload handlers.
    const wellSelect = $('well-select');
    if (wellSelect) wellSelect.addEventListener('change', showImportLasForm);
    const selectExistingLasBtn = $('select-existing-las-btn');
    const directInput = $('las-file-input');
    if (selectExistingLasBtn && directInput) selectExistingLasBtn.addEventListener('click', () => directInput.click());
    if (directInput) directInput.addEventListener('change', () => addDirectFiles(directInput.files));
    const lasDrop = $('las-drop-zone');
    if (lasDrop) {
      lasDrop.addEventListener('click', e => { if (!e.target.closest('button')) directInput && directInput.click(); });
      ['dragenter', 'dragover'].forEach(evt => lasDrop.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); lasDrop.classList.add('drag-over'); }));
      ['dragleave', 'drop'].forEach(evt => lasDrop.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); lasDrop.classList.remove('drag-over'); }));
      lasDrop.addEventListener('drop', e => addDirectFiles(e.dataTransfer.files));
    }
    const validateBtn = $('validate-las-btn');
    if (validateBtn) validateBtn.addEventListener('click', function () {
      if (!selectedWellName()) return setDirectStatus('<i class="fas fa-exclamation-circle"></i> Select a well before validating files.', 'error');
      if (!directFiles.length) return setDirectStatus('<i class="fas fa-exclamation-circle"></i> Select LAS files before validation.', 'error');
      const invalid = directFiles.filter(f => !f.name.toLowerCase().endsWith('.las') || f.size <= 0);
      if (invalid.length) setDirectStatus(`<i class="fas fa-exclamation-circle"></i> ${invalid.length} invalid file(s) found. Remove invalid files before upload.`, 'error');
      else setDirectStatus(`<i class="fas fa-check-circle"></i> Validation passed. ${directFiles.length} LAS file(s) ready to upload.`, 'success');
      renderDirectTable();
    });
    const clearDirectFilesBtn = $('clear-direct-files-btn');
    if (clearDirectFilesBtn) {
      clearDirectFilesBtn.addEventListener('click', function () {
        directFiles = [];
        if (directInput) directInput.value = '';
        setDirectStatus('<i class="fas fa-check-circle"></i> Selected LAS files cleared.', 'success');
        renderDirectTable();
      });
    }

    const importLasForm = $('import-las-form');
    if (importLasForm) {
      importLasForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const projectName = getProjectName();
        const well = selectedWellName();
        if (!projectName) return setDirectStatus('<i class="fas fa-exclamation-circle"></i> Project name not found.', 'error');
        if (!well) return setDirectStatus('<i class="fas fa-exclamation-circle"></i> Please select a well first.', 'error');
        if (!directFiles.length) return setDirectStatus('<i class="fas fa-exclamation-circle"></i> Please choose one or more LAS files.', 'error');
        if (!directFiles.every(f => f.name.toLowerCase().endsWith('.las') && f.size > 0)) return setDirectStatus('<i class="fas fa-exclamation-circle"></i> Remove invalid or empty files before upload.', 'error');
        const btn = $('upload-las-btn');
        if (btn) btn.disabled = true;
        try {
          markRows('Uploading', 'info');
          setDirectStatus('<i class="fas fa-spinner fa-spin"></i> Uploading LAS files...', 'info');
          await uploadLasFiles(projectName, well, directFiles, (done, total) => setDirectStatus(`<i class="fas fa-spinner fa-spin"></i> Uploaded ${done}/${total} LAS files...`, 'info'));
          markRows('Uploaded', 'success');
          setDirectStatus('<i class="fas fa-check-circle"></i> LAS files uploaded successfully. Reloading file list...', 'success');
          setTimeout(() => window.location.reload(), 1000);
        } catch (err) {
          console.error(err);
          markRows('Failed', 'error');
          setDirectStatus('<i class="fas fa-times-circle"></i> LAS upload failed: ' + err.message, 'error');
          if (btn) btn.disabled = false;
        }
      });
    }

    // Global click actions.
    document.body.addEventListener('click', function (e) {
      const removeDirect = e.target.closest('.remove-direct-file');
      if (removeDirect) {
        directFiles.splice(Number(removeDirect.dataset.index), 1);
        renderDirectTable();
        return;
      }
      const removeSelected = e.target.closest('.remove-selected-well');
      if (removeSelected) {
        selectedWellFiles.delete(removeSelected.dataset.well);
        renderSelectedFolders();
        return;
      }
      const removeWellBtn = e.target.closest('.remove-well-btn');
      if (removeWellBtn) {
        const projectName = getProjectName();
        const well = removeWellBtn.dataset.well;
        if (!projectName || !well) return alert('Project or well missing.');
        if (!confirm(`Delete well "${well}" and its LAS files?`)) return;
        fetch(`/project/${encodeURIComponent(projectName)}/remove_well/${encodeURIComponent(well)}`, { method: 'DELETE' })
          .then(r => r.json().then(d => ({ ok: r.ok, d })))
          .then(({ ok, d }) => { if (!ok || !d.success) throw new Error(d.message || 'Delete failed'); location.reload(); })
          .catch(err => alert('Delete failed: ' + err.message));
        return;
      }
      const removeLasBtn = e.target.closest('.remove-las-btn');
      if (removeLasBtn) {
        const projectName = getProjectName();
        const well = removeLasBtn.dataset.well;
        const file = removeLasBtn.dataset.file;
        if (!projectName || !well || !file) return alert('Project, well, or file missing.');
        if (!confirm(`Delete LAS file "${file}" from well "${well}"?`)) return;
        fetch(`/project/${encodeURIComponent(projectName)}/well/${encodeURIComponent(well)}/file/${encodeURIComponent(file)}`, { method: 'DELETE' })
          .then(r => r.json().then(d => ({ ok: r.ok, d })))
          .then(({ ok, d }) => { if (!ok || !d.success) throw new Error(d.message || 'Delete failed'); location.reload(); })
          .catch(err => alert('Delete failed: ' + err.message));
        return;
      }
      const downloadBtn = e.target.closest('.download-btn');
      if (downloadBtn) {
        const project = downloadBtn.dataset.project || getProjectName();
        const well = downloadBtn.dataset.well;
        const filename = downloadBtn.dataset.filename || `${well}_spliced.las`;
        window.location.href = `/download_autosplice/${encodeURIComponent(project)}/${encodeURIComponent(filename)}`;
      }
    });

    const createWellForm = document.querySelector('#create-well form');
    if (createWellForm) {
      createWellForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const projectName = getProjectName();
        const wellName = $('new-well-name') ? $('new-well-name').value.trim() : '';
        if (!projectName || !wellName) return alert('Enter a well name.');
        try {
          const data = await createWell(projectName, wellName);
          alert(data.message || 'Well created successfully.');
          window.location.reload();
        } catch (err) { alert('Create well failed: ' + err.message); }
      });
    }

    const wellList = $('well-list');
    if (wellList) {
      wellList.addEventListener('click', function (e) {
        const toggle = e.target.closest('.folder-toggle');
        if (toggle && !e.target.closest('input,button')) {
          const folder = toggle.closest('.well-folder');
          const files = folder && folder.querySelector('.las-files');
          if (files) files.classList.toggle('hidden');
        }
      });
    }
    qsa('.well-checkbox').forEach(cb => cb.addEventListener('change', function () {
      const checked = qsa('.well-checkbox:checked').length;
      const btn = $('auto-select-btn');
      if (btn) btn.disabled = checked === 0;
    }));

    async function runAutoSplicePreparation() {
      let selectedWells = qsa('.well-checkbox:checked').map(cb => cb.value);
      const projectName = getProjectName();
      if (!projectName) return alert('Project name not found.');

      // The right-side Generate AutoSplice button should work too. If the user
      // has not ticked checkboxes, use all visible wells that contain LAS files.
      if (!selectedWells.length) {
        selectedWells = qsa('.well-folder').filter(folder => folder.querySelector('.las-file-name')).map(folder => folder.dataset.well).filter(Boolean);
      }
      if (!selectedWells.length) return alert('Please select at least one well with LAS files.');

      const buttons = [$('auto-select-btn'), $('config-generate-btn')].filter(Boolean);
      const status = $('auto-select-status');
      const spinner = $('auto-select-spinner');
      buttons.forEach(btn => { btn.disabled = true; });
      if (spinner) { spinner.classList.remove('hidden'); spinner.style.display = 'inline-block'; }
      if (status) status.textContent = 'Validating LAS files and preparing AutoSplice...';
      try {
        const r = await fetch('/process_selected_wells', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_name: projectName, selected_wells: selectedWells })
        });
        const d = await r.json().catch(async () => ({ message: await r.text() }));
        if (!r.ok || !d.success) throw new Error(d.message || 'Process failed');
        if (status) status.textContent = d.message || 'Prepared successfully.';
        if (d.redirect) window.location.href = d.redirect;
      } catch (err) {
        console.error(err);
        if (status) status.textContent = '';
        alert('AutoSplice preparation failed: ' + err.message);
        buttons.forEach(btn => { btn.disabled = false; });
      } finally {
        if (spinner) { spinner.classList.add('hidden'); spinner.style.display = 'none'; }
      }
    }

    const autoSelectBtn = $('auto-select-btn');
    if (autoSelectBtn) autoSelectBtn.addEventListener('click', runAutoSplicePreparation);
    const configGenerateBtn = $('config-generate-btn');
    if (configGenerateBtn) configGenerateBtn.addEventListener('click', runAutoSplicePreparation);
  });
})();
