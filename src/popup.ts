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
  
  // Phase 5: Proactive generation toggle
  private proactiveGenerationToggle: HTMLInputElement | null = null;
  
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
    
    // Phase 5 elements
    this.proactiveGenerationToggle = document.getElementById('proactiveGenerationToggle') as HTMLInputElement;
    
    // Load API key from storage
    await this.loadApiKey();
    
    // Load proactive generation setting
    await this.loadProactiveGenerationSetting();
    
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
    
    // Phase 5: Proactive generation toggle
    this.proactiveGenerationToggle?.addEventListener('change', (e) => {
      this.toggleProactiveGeneration((e.target as HTMLInputElement).checked);
    });
    
    // Phase 5: Manual test triggers
    document.getElementById('triggerProactiveGeneration')?.addEventListener('click', () => {
      this.triggerManualGeneration();
    });
    
    document.getElementById('openWidgetPanel')?.addEventListener('click', () => {
      this.openWidgetPanel();
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
  
  // ============================================================================
  // Phase 5: Proactive Tool Generation
  // ============================================================================
  
  /**
   * Load proactive generation setting from storage
   */
  private async loadProactiveGenerationSetting(): Promise<void> {
    try {
      const result = await chrome.storage.sync.get(['proactive_generation_enabled']);
      const isEnabled = result.proactive_generation_enabled ?? true; // Default: enabled
      
      if (this.proactiveGenerationToggle) {
        this.proactiveGenerationToggle.checked = isEnabled;
      }
      
      logger.info('Popup', 'Proactive generation setting loaded', { isEnabled });
      
    } catch (error) {
      logger.error('Popup', 'Failed to load proactive generation setting', error);
    }
  }
  
  /**
   * Toggle proactive generation on/off
   */
  private async toggleProactiveGeneration(enabled: boolean): Promise<void> {
    try {
      // Save to Chrome storage
      await chrome.storage.sync.set({ proactive_generation_enabled: enabled });
      
      // Send message to background script
      const message = createMessage('TOGGLE_PROACTIVE_GENERATION', { enabled }, 'background');
      await chrome.runtime.sendMessage(message);
      
      logger.info('Popup', 'Proactive generation toggled', { enabled });
      
    } catch (error) {
      logger.error('Popup', 'Failed to toggle proactive generation', error);
      
      // Revert toggle on error
      if (this.proactiveGenerationToggle) {
        this.proactiveGenerationToggle.checked = !enabled;
      }
    }
  }
  
  /**
   * Manually trigger widget generation for testing
   */
  private async triggerManualGeneration(): Promise<void> {
    try {
      logger.info('Popup', 'Manually triggering widget generation');
      
      const message = createMessage('TRIGGER_MANUAL_GENERATION', {}, 'background');
      const response = await chrome.runtime.sendMessage(message);
      
      if (response.success) {
        alert('Widget generation triggered! Check the background console for logs.');
      } else {
        alert(`Generation failed: ${response.error || 'Unknown error'}`);
      }
      
    } catch (error) {
      logger.error('Popup', 'Failed to trigger manual generation', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Open widget panel in active tab
   */
  private async openWidgetPanel(): Promise<void> {
    try {
      logger.info('Popup', 'Opening widget panel');
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.id) {
        alert('No active tab found');
        return;
      }
      
      // Send message to content script to open panel
      const message = createMessage('OPEN_WIDGET_PANEL', {}, 'content');
      await chrome.tabs.sendMessage(tab.id, message);
      
      // Close popup
      window.close();
      
    } catch (error) {
      logger.error('Popup', 'Failed to open widget panel', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
