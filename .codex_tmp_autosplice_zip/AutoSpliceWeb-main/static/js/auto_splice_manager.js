class AutoSpliceManager {
  constructor() {
    this.statusMessage = document.querySelector('.status-message');
    this.spinner = document.querySelector('.spinner');
    this.wellProgress = document.getElementById('well-progress');
    this.downloadLinks = document.getElementById('download-links');
    this.projectName = (document.getElementById('project-name')?.value || document.querySelector('.project-name')?.textContent?.replace('Project:', '') || '').trim();
    this.connectEventSource();
    this.addConnectionStatus();
    this.loadExistingResults();
  }
  connectEventSource() {
    this.eventSource = new EventSource('/process-updates');
    this.eventSource.onopen = () => {
      this.updateStatusMessage('Connected. Waiting for AutoSplice updates...');
      const dot = document.getElementById('connection-dot'); const txt = document.getElementById('connection-text');
      if (dot) dot.style.background = '#19c37d'; if (txt) txt.textContent = 'Connected';
    };
    this.eventSource.onmessage = (event) => {
      try { this.handleUpdate(JSON.parse(event.data)); } catch (e) { console.error(e); }
    };
    this.eventSource.onerror = () => {
      const dot = document.getElementById('connection-dot'); const txt = document.getElementById('connection-text');
      if (dot) dot.style.background = '#ef4444'; if (txt) txt.textContent = 'Disconnected';
    };
  }
  handleUpdate(data) {
    if (!data || !data.type) return;
    if (data.type === 'status' || data.type === 'warning') {
      this.addStatus(data.message, data.type === 'warning' ? 'warning' : 'running');
      this.updateStatusMessage(data.message);
      this.showSpinner();
    } else if (data.type === 'well_processed') {
      this.addResult(data.well, 'Success', data.message || 'Completed successfully', data.spliced_file, data.provenance_file);
      this.updateStatusMessage(data.message || 'Completed successfully', 'success');
    } else if (data.type === 'complete') {
      this.hideSpinner();
      this.updateStatusMessage(data.message || 'Completed successfully', 'success');
      if (Array.isArray(data.results)) data.results.forEach(r => this.addResult(r.well, r.status, r.message, r.spliced_file, r.provenance_file));
      this.loadExistingResults();
    } else if (data.type === 'error') {
      this.hideSpinner();
      this.addStatus(data.message || 'AutoSplice error', 'error');
      this.updateStatusMessage(data.message || 'AutoSplice error', 'error');
      if (Array.isArray(data.results)) data.results.forEach(r => this.addResult(r.well, r.status, r.message, r.spliced_file, r.provenance_file));
    }
  }
  addStatus(message, status='running') {
    if (!this.wellProgress) return;
    const div = document.createElement('div');
    div.className = `well-status ${status === 'error' ? 'error' : status === 'warning' ? 'warning' : ''}`;
    const icon = status === 'error' ? '❌' : status === 'warning' ? '⚠️' : '•';
    div.innerHTML = `<span class="status-icon">${icon}</span><span>${this.escape(message || '')}</span>`;
    this.wellProgress.appendChild(div);
  }
  addResult(well, status, message, splicedFile, provenanceFile) {
    if (!this.downloadLinks || !well) return;
    const id = `result-${well}`.replace(/[^a-z0-9_-]/gi, '_');
    let existing = document.getElementById(id);
    if (existing) existing.remove();
    const ok = status === 'Success';
    const div = document.createElement('div');
    div.id = id;
    div.className = `well-status ${ok ? 'success' : 'error'}`;
    const lasName = splicedFile || `${well}_spliced.las`;
    const provName = provenanceFile || `${well}_spliced_provenance.json`;
    div.innerHTML = `
      <span class="status-icon">${ok ? '✓' : '❌'}</span>
      <div style="width:100%">
        <strong>${this.escape(well)}</strong> — ${this.escape(status || '')}<br>
        <span>${this.escape(message || '')}</span>
        ${ok ? `<div class="source-files" style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;">
          <a class="download-link" href="/download_autosplice/${encodeURIComponent(this.projectName)}/${encodeURIComponent(lasName)}"><i class="fas fa-download"></i> Download LAS</a>
          <a class="download-link" href="/download_autosplice/${encodeURIComponent(this.projectName)}/${encodeURIComponent(provName)}"><i class="fas fa-file-code"></i> Download Provenance JSON</a>
          <a class="download-link" href="/viewer/${encodeURIComponent(this.projectName)}/${encodeURIComponent(well)}" target="_blank"><i class="fas fa-eye"></i> Open in Viewer</a>
        </div>` : ''}
      </div>`;
    this.downloadLinks.appendChild(div);
  }
  async loadExistingResults() {
    if (!this.projectName || !this.downloadLinks) return;
    try {
      const res = await fetch(`/api/project/${encodeURIComponent(this.projectName)}/autosplice_results`);
      const data = await res.json();
      if (data.success && Array.isArray(data.results) && data.results.length) {
        data.results.forEach(r => this.addResult(r.well, r.status, 'Generated spliced LAS is available.', r.filename, r.provenance));
      }
    } catch (e) { console.warn(e); }
  }
  updateStatusMessage(message, cls='') { if (this.statusMessage) { this.statusMessage.textContent = message || ''; this.statusMessage.className = `status-message ml-3 ${cls}`; } }
  showSpinner() { if (this.spinner) this.spinner.classList.remove('hidden'); }
  hideSpinner() { if (this.spinner) this.spinner.classList.add('hidden'); }
  addConnectionStatus() {
    const container = document.getElementById('progress-container'); if (!container) return;
    const div = document.createElement('div');
    div.className = 'connection-status mb-4';
    div.innerHTML = '<span id="connection-dot" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#94a3b8;margin-right:8px;"></span><span id="connection-text">Connecting...</span>';
    container.insertBefore(div, container.firstChild);
  }
  escape(s) { return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
}
document.addEventListener('DOMContentLoaded', () => { window.autoSpliceManager = new AutoSpliceManager(); });
