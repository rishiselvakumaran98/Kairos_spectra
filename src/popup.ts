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

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Get DOM elements
    this.statusEl = document.getElementById('status');
    this.interactionsEl = document.getElementById('interactions');
    this.strugglesEl = document.getElementById('struggles');

    // Query active tab for perception agent status
    await this.updateStatus();

    // Refresh every 2 seconds
    setInterval(() => this.updateStatus(), 2000);
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
