/**
 * KAIROS-SPECTRA Popup Script
 * 
 * UI for monitoring agent status
 */

import { logger, createMessage } from './utils';

class KairosSpectraPopup {
  private statusEl: HTMLElement | null = null;
  private interactionsEl: HTMLElement | null = null;
  private strugglesEl: HTMLElement | null = null;
  
  // Settings UI elements
  private apiKeyInput: HTMLInputElement | null = null;
  private lockBtn: HTMLButtonElement | null = null;
  private saveBtn: HTMLButtonElement | null = null;
  private apiStatusEl: HTMLElement | null = null;
  private apiStatusText: HTMLElement | null = null;
  
  private isLocked: boolean = true;
  private originalApiKey: string = '';

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Get DOM elements
    this.statusEl = document.getElementById('status');
    this.interactionsEl = document.getElementById('interactions');
    this.strugglesEl = document.getElementById('struggles');
    
    // Settings elements
    this.apiKeyInput = document.getElementById('apiKeyInput') as HTMLInputElement;
    this.lockBtn = document.getElementById('lockBtn') as HTMLButtonElement;
    this.saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
    this.apiStatusEl = document.getElementById('apiStatus');
    this.apiStatusText = document.getElementById('apiStatusText');
    
    // Load API key from storage
    await this.loadApiKey();
    
    // Set up event listeners
    this.setupEventListeners();

    // Query active tab for perception agent status
    await this.updateStatus();

    // Refresh every 2 seconds
    setInterval(() => this.updateStatus(), 2000);
  }
  
  private setupEventListeners(): void {
    // Lock/unlock toggle
    this.lockBtn?.addEventListener('click', () => {
      this.toggleLock();
    });
    
    // Save button
    this.saveBtn?.addEventListener('click', () => {
      this.saveApiKey();
    });
    
    // Input change detection
    this.apiKeyInput?.addEventListener('input', () => {
      this.onApiKeyChange();
    });
    
    // Enter key to save
    this.apiKeyInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !this.isLocked) {
        this.saveApiKey();
      }
    });
  }
  
  private async loadApiKey(): Promise<void> {
    try {
      const result = await chrome.storage.sync.get(['openai_api_key']);
      const apiKey = result.openai_api_key || '';
      
      this.originalApiKey = apiKey;
      
      if (this.apiKeyInput) {
        this.apiKeyInput.value = apiKey;
        if (apiKey) {
          this.apiKeyInput.classList.add('has-value');
        }
      }
      
      this.updateApiStatus(apiKey);
      
    } catch (error) {
      logger.error('Popup', 'Failed to load API key', error);
      this.setApiStatus('error', '❌ Failed to load');
    }
  }
  
  private async saveApiKey(): Promise<void> {
    if (!this.apiKeyInput || this.isLocked) return;
    
    const newApiKey = this.apiKeyInput.value.trim();
    
    try {
      // Save to Chrome storage (persists across sessions)
      await chrome.storage.sync.set({ openai_api_key: newApiKey });
      
      this.originalApiKey = newApiKey;
      
      // Show success feedback
      if (this.saveBtn) {
        this.saveBtn.textContent = '✓ Saved';
        this.saveBtn.classList.add('saved');
        this.saveBtn.disabled = true;
      }
      
      this.updateApiStatus(newApiKey);
      
      // Lock after saving
      setTimeout(() => {
        this.lockInput();
      }, 1000);
      
      logger.info('Popup', 'API key saved successfully');
      
    } catch (error) {
      logger.error('Popup', 'Failed to save API key', error);
      this.setApiStatus('error', '❌ Failed to save');
    }
  }
  
  private toggleLock(): void {
    if (this.isLocked) {
      this.unlockInput();
    } else {
      this.lockInput();
    }
  }
  
  private unlockInput(): void {
    this.isLocked = false;
    
    if (this.lockBtn) {
      this.lockBtn.textContent = '🔓';
      this.lockBtn.classList.remove('locked');
      this.lockBtn.title = 'Lock to prevent changes';
    }
    
    if (this.apiKeyInput) {
      this.apiKeyInput.disabled = false;
      this.apiKeyInput.type = 'text'; // Show plaintext when unlocked
      this.apiKeyInput.focus();
      this.apiKeyInput.select();
    }
    
    if (this.saveBtn) {
      this.saveBtn.disabled = true; // Enable after changes
    }
  }
  
  private lockInput(): void {
    this.isLocked = true;
    
    if (this.lockBtn) {
      this.lockBtn.textContent = '🔒';
      this.lockBtn.classList.add('locked');
      this.lockBtn.title = 'Unlock to edit';
    }
    
    if (this.apiKeyInput) {
      this.apiKeyInput.disabled = true;
      this.apiKeyInput.type = 'password'; // Hide when locked
    }
    
    if (this.saveBtn) {
      this.saveBtn.textContent = 'Save';
      this.saveBtn.classList.remove('saved');
      this.saveBtn.disabled = true;
    }
    
    // Restore original value if changed but not saved
    if (this.apiKeyInput && this.apiKeyInput.value.trim() !== this.originalApiKey) {
      this.apiKeyInput.value = this.originalApiKey;
    }
  }
  
  private onApiKeyChange(): void {
    if (!this.apiKeyInput || this.isLocked) return;
    
    const newValue = this.apiKeyInput.value.trim();
    const hasChanged = newValue !== this.originalApiKey;
    
    // Enable save button if changed
    if (this.saveBtn) {
      this.saveBtn.disabled = !hasChanged;
      this.saveBtn.classList.remove('saved');
    }
    
    // Update styling
    if (newValue) {
      this.apiKeyInput.classList.add('has-value');
    } else {
      this.apiKeyInput.classList.remove('has-value');
    }
  }
  
  private updateApiStatus(apiKey: string): void {
    if (!apiKey) {
      this.setApiStatus('', '⚪ No API key set');
    } else if (apiKey.startsWith('sk-') && apiKey.length > 20) {
      this.setApiStatus('success', `✓ API key set (${apiKey.length} chars)`);
    } else {
      this.setApiStatus('error', '⚠️ Invalid key format');
    }
  }
  
  private setApiStatus(className: string, text: string): void {
    if (this.apiStatusEl) {
      this.apiStatusEl.className = `api-status ${className}`;
    }
    if (this.apiStatusText) {
      this.apiStatusText.textContent = text;
    }
  }

  private async updateStatus(): Promise<void> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.id) {
        this.showError('No active tab');
        return;
      }

      const message = createMessage('PERCEPTION_STATUS', {}, 'background');
      
      const response = await chrome.tabs.sendMessage(tab.id, message);

      if (response?.isActive) {
        this.showActive(response.state);
      } else {
        this.showInactive();
      }
    } catch (error) {
      this.showError('Content script not loaded');
      logger.error('Popup', 'Failed to get status', error);
    }
  }

  private showActive(state: any): void {
    if (this.statusEl) {
      this.statusEl.className = 'status active';
      this.statusEl.innerHTML = `
        <div class="status-label">Status</div>
        <div class="status-value">🟢 Active</div>
      `;
    }

    if (this.interactionsEl) {
      this.interactionsEl.textContent = String(state.interactionBuffer?.length || 0);
    }

    if (this.strugglesEl) {
      this.strugglesEl.textContent = state.lastStruggleDetection ? '1+' : '0';
    }
  }

  private showInactive(): void {
    if (this.statusEl) {
      this.statusEl.className = 'status';
      this.statusEl.innerHTML = `
        <div class="status-label">Status</div>
        <div class="status-value">⚪ Inactive</div>
      `;
    }
  }

  private showError(message: string): void {
    if (this.statusEl) {
      this.statusEl.className = 'status';
      this.statusEl.innerHTML = `
        <div class="status-label">Status</div>
        <div class="status-value">❌ ${message}</div>
      `;
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new KairosSpectraPopup();
  });
} else {
  new KairosSpectraPopup();
}
