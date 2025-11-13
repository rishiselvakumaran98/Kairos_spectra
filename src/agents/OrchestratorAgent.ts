/**
 * KAIROS-SPECTRA Orchestrator Agent
 * Phase 2: The "Brain" of the Guidance System
 * 
 * Implements FlowForge's hierarchical abstraction levels (Hao et al. 194-202):
 * - Level 1: Task Planning (analytical goals)
 * - Level 2: Agent Assignment (viz type selection)
 * - Level 3: Agent Optimization (refinement loop)
 * 
 * This agent coordinates between:
 * - PerceptionAgent (struggle detection)
 * - DataAgent (data extraction)
 * - VisionAgent (visual fallback)
 * - VisualizationAgent (chart generation)
 * - HierarchicalGuidanceUI (UI management)
 */

import type {
  DataExtractionResult,
  GuidanceLevel,
  AnalyticalGoal,
  VizType,
  OrchestratorState,
  InferredContext,
  RefinementRequest,
  ExtractedData,
  Proposition,
  QueryParams,
  StruggleEvent,
} from '../types';
import { logger } from '../utils';
import { hierarchicalGuidanceUI } from '../ui/HierarchicalGuidanceUI';
import { visualizationAgent } from './VisualizationAgent';

export class OrchestratorAgent {
  private state: OrchestratorState;

  constructor() {
    this.state = {
      currentLevel: 'TASK_PLANNING',
      extractionResult: null,
      selectedGoal: null,
      selectedVizType: null,
      currentVizSpec: null,
      refinementHistory: [],
      isUIVisible: false,
    };

    logger.info('OrchestratorAgent', 'Initialized with FlowForge hierarchical abstraction model');
  }

  /**
   * Main entry point: Start the hierarchical guidance flow
   * Called by ContentScript when struggle is detected and data is extracted
   */
  public async startHierarchicalGuidance(
    extractionResult: DataExtractionResult,
    struggleEvent?: StruggleEvent
  ): Promise<void> {
    try {
      logger.info('OrchestratorAgent', 'Starting hierarchical guidance flow', {
        extractedDataCount: extractionResult.extractedData.length,
        struggleEventId: extractionResult.struggleEventId,
        struggleType: struggleEvent?.pattern?.type,
      });

      // Update state
      this.state.extractionResult = extractionResult;
      this.state.currentLevel = 'TASK_PLANNING';
      this.state.isUIVisible = true;

      // PHASE 2: ALWAYS show GUM user interaction popup for ALL struggles
      // GUM provides context-aware insights for any type of struggle
      logger.info('OrchestratorAgent', 'Struggle detected - showing GUM user model popup', {
        struggleType: struggleEvent?.pattern?.type,
      });
      
      await this.showHesitationPopupWithGUM(extractionResult);

    } catch (error) {
      logger.error('OrchestratorAgent', 'Failed to start guidance', error);
      this.dismissGuidance();
    }
  }

  /**
   * NEW: Chart Analysis Mode - For existing charts/visualizations
   * User wants help UNDERSTANDING existing chart, not creating new one
   */
  private async showChartAnalysisMode(extractionResult: DataExtractionResult): Promise<void> {
    logger.info('OrchestratorAgent', 'Entering Chart Analysis Mode');

    const visionData = extractionResult.extractedData.find(
      (d) => d.type === 'chart' || (d.data as any).extractedVia === 'vision'
    );

    if (!visionData) {
      logger.warn('OrchestratorAgent', 'No vision data in analysis mode');
      this.dismissGuidance();
      return;
    }

    // Extract chart information
    const chartType = (visionData.data as any).chartType || 'visualization';
    const dataDescription = (visionData.data as any).dataDescription || '';
    const possibleActions = (visionData.data as any).possibleActions || [];

    // Show intelligent analysis UI with:
    // 1. Chart screenshot/description
    // 2. AI-generated insights
    // 3. Conversation interface (not chart type selection!)
    await hierarchicalGuidanceUI.showChartAnalysisUI({
      chartType,
      dataDescription,
      possibleActions,
      visionData,
      onSnipChart: () => this.handleChartSnip(),
      onAskQuestion: (question: string) => this.handleChartQuestion(question, visionData),
      onDismiss: () => this.dismissGuidance(),
    });
  }

  /**
   * Handle user requesting to snip/screenshot specific chart area
   */
  private async handleChartSnip(): Promise<void> {
    logger.info('OrchestratorAgent', 'User requested chart snip');

    // Show snipping UI overlay
    hierarchicalGuidanceUI.showSnipMode({
      onSnipComplete: async (screenshotData: string, boundingBox: any) => {
        logger.info('OrchestratorAgent', 'Chart snipped, analyzing with GPT-4V');

        // Use VisionAgent to analyze the snipped region
        const { visionAgent } = await import('./VisionAgent');
        
        // Analyze the specific chart region
        const analysisResult = await visionAgent.analyzeChartSnippet(screenshotData, boundingBox);

        if (analysisResult) {
          // Show analysis results with insights
          await hierarchicalGuidanceUI.showChartInsights({
            chartType: analysisResult.chartType,
            insights: analysisResult.insights,
            trends: analysisResult.trends,
            suggestions: analysisResult.suggestions,
            onAskFollowUp: (q: string) => this.handleChartQuestion(q, analysisResult),
            onDismiss: () => this.dismissGuidance(),
          });
        }
      },
      onCancel: () => {
        // Go back to chart analysis UI
        this.showChartAnalysisMode(this.state.extractionResult!);
      },
    });
  }

  /**
   * Handle user asking questions about the chart
   * This creates a conversational flow instead of rigid chart selection
   */
  private async handleChartQuestion(question: string, chartData: any): Promise<void> {
    logger.info('OrchestratorAgent', 'User asked about chart', { question });

    // Show thinking state
    hierarchicalGuidanceUI.showThinking();

    try {
      // Use GPT-4V to answer the question about the chart
      const { visionAgent } = await import('./VisionAgent');
      
      const answer = await visionAgent.answerChartQuestion(question, chartData);

      if (!answer) {
        throw new Error('No answer received from vision analysis');
      }

      // Show answer in chat interface
      hierarchicalGuidanceUI.showChatResponse({
        question,
        answer: answer.response,
        suggestions: answer.followUpSuggestions,
        onAskFollowUp: (q: string) => this.handleChartQuestion(q, chartData),
        onSnipChart: () => this.handleChartSnip(),
        onDismiss: () => this.dismissGuidance(),
      });

    } catch (error) {
      logger.error('OrchestratorAgent', 'Failed to answer chart question', error);
      hierarchicalGuidanceUI.showError('Failed to analyze chart. Please try again.');
    }
  }

  /**
   * Check if guidance UI is currently active
   * Used to prevent context switching during user interaction
   */
  public isGuidanceActive(): boolean {
    return this.state.isUIVisible;
  }

  /**
   * Level 1 → Level 2: User selected an analytical goal
   */
  private async handleGoalSelection(goal: AnalyticalGoal): Promise<void> {
    try {
      logger.info('OrchestratorAgent', 'Goal selected, transitioning to VIZ_SELECTION', { goal });

      this.state.selectedGoal = goal;
      this.state.currentLevel = 'VIZ_SELECTION';

      // Show Level 2: Viz Selection UI
      await hierarchicalGuidanceUI.showVizSelectionUI(goal, {
        onVizTypeSelected: (vizType: VizType) => this.handleVizTypeSelection(vizType),
        onBack: () => this.backToTaskPlanning(),
        onDismiss: () => this.dismissGuidance(),
      });

      logger.info('OrchestratorAgent', 'Viz Selection UI shown');

    } catch (error) {
      logger.error('OrchestratorAgent', 'Failed to handle goal selection', error);
    }
  }

  /**
   * Level 2 → Level 3: User selected a viz type, generate and show chart
   */
  private async handleVizTypeSelection(vizType: VizType): Promise<void> {
    try {
      logger.info('OrchestratorAgent', 'Viz type selected, generating chart', { vizType });

      this.state.selectedVizType = vizType;
      this.state.currentLevel = 'REFINEMENT';

      // Generate Vega-Lite spec using VisualizationAgent
      const spec = await visualizationAgent.generateVegaLiteSpec(
        this.state.extractionResult!.extractedData,
        this.state.selectedGoal!,
        vizType
      );

      this.state.currentVizSpec = spec;

      // Show Level 3: Refinement UI with rendered chart
      await hierarchicalGuidanceUI.showRefinementUI(spec, {
        onRefine: (userPrompt: string) => this.handleRefinement(userPrompt),
        onBack: () => this.backToVizSelection(),
        onDismiss: () => this.dismissGuidance(),
      });

      logger.info('OrchestratorAgent', 'Refinement UI shown with chart');

    } catch (error) {
      logger.error('OrchestratorAgent', 'Failed to handle viz type selection', error);
      
      // Show user-friendly error message
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'An unexpected error occurred while generating the visualization.';
      
      hierarchicalGuidanceUI.showError(errorMessage);
    }
  }

  /**
   * Level 3: User wants to refine the visualization
   * Implements Amershi et al. G9: Support efficient correction
   */
  private async handleRefinement(userPrompt: string): Promise<void> {
    try {
      logger.info('OrchestratorAgent', 'User refinement requested', { userPrompt });

      // Add to history
      this.state.refinementHistory.push(userPrompt);

      // Create refinement request
      const refinementRequest: RefinementRequest = {
        userPrompt,
        currentSpec: this.state.currentVizSpec,
        originalData: this.state.extractionResult!.extractedData,
      };

      // Generate new spec with refinement
      const newSpec = await visualizationAgent.refineVisualization(refinementRequest);

      if (!newSpec) {
        logger.warn('OrchestratorAgent', 'Failed to refine visualization');
        hierarchicalGuidanceUI.showError('Could not understand refinement request. Please try rephrasing.');
        return;
      }

      this.state.currentVizSpec = newSpec;

      // Update the chart in the UI
      await hierarchicalGuidanceUI.updateChart(newSpec);

      logger.info('OrchestratorAgent', 'Chart refined successfully');

    } catch (error) {
      logger.error('OrchestratorAgent', 'Failed to handle refinement', error);
      hierarchicalGuidanceUI.showError('Error refining visualization.');
    }
  }

  /**
   * Navigate back to Task Planning (Level 1)
   */
  private async backToTaskPlanning(): Promise<void> {
    logger.info('OrchestratorAgent', 'Navigating back to Task Planning');

    this.state.currentLevel = 'TASK_PLANNING';
    this.state.selectedGoal = null;
    this.state.selectedVizType = null;
    this.state.currentVizSpec = null;

    const context = this.inferContext(this.state.extractionResult!);

    await hierarchicalGuidanceUI.showTaskPlanningUI(this.state.extractionResult!, context, {
      onGoalSelected: (goal: AnalyticalGoal) => this.handleGoalSelection(goal),
      onDismiss: () => this.dismissGuidance(),
    });
  }

  /**
   * Navigate back to Viz Selection (Level 2)
   */
  private async backToVizSelection(): Promise<void> {
    logger.info('OrchestratorAgent', 'Navigating back to Viz Selection');

    this.state.currentLevel = 'VIZ_SELECTION';
    this.state.selectedVizType = null;
    this.state.currentVizSpec = null;

    await hierarchicalGuidanceUI.showVizSelectionUI(this.state.selectedGoal!, {
      onVizTypeSelected: (vizType: VizType) => this.handleVizTypeSelection(vizType),
      onBack: () => this.backToTaskPlanning(),
      onDismiss: () => this.dismissGuidance(),
    });
  }

  /**
   * Dismiss the guidance UI and reset state
   */
  public dismissGuidance(): void {
    logger.info('OrchestratorAgent', 'Dismissing guidance UI');

    hierarchicalGuidanceUI.hide();

    this.state = {
      currentLevel: 'TASK_PLANNING',
      extractionResult: null,
      selectedGoal: null,
      selectedVizType: null,
      currentVizSpec: null,
      refinementHistory: [],
      isUIVisible: false,
    };

    // Resume perception agent to detect future struggles
    // Import perceptionAgent at runtime to avoid circular dependency
    import('./PerceptionAgent').then((module) => {
      module.perceptionAgent.resume();
      logger.info('OrchestratorAgent', 'Resumed perception after guidance dismissed');
    });
  }

  /**
   * Infer context from extracted data for smart UI messaging
   * E.g., "I see you're exploring a scatter plot comparing MPG vs Horsepower"
   */
  private inferContext(extractionResult: DataExtractionResult): InferredContext {
    const { extractedData } = extractionResult;

    // Default context
    let message = `I noticed you might need help with the data on this page.`;
    const dataElements: string[] = [];
    let confidence = 0.7;

    if (extractedData.length === 0) {
      return { message: 'I detected you might be struggling, but could not extract data.', dataElements: [], confidence: 0.3 };
    }

    // Check if data came from vision (charts, visualizations)
    const visionData = extractedData.find((d) => (d.data as any).extractedVia === 'vision');
    if (visionData) {
      const chartType = (visionData.data as any).chartType || 'visualization';
      const desc = (visionData.data as any).dataDescription || '';
      const possibleActions = (visionData.data as any).possibleActions || [];
      
      // Create intelligent message based on chart type
      let contextMessage = `I see you're exploring a ${chartType}`;
      if (desc) {
        contextMessage += ` showing ${desc}`;
      }
      contextMessage += '. ';
      
      // Add proactive suggestions based on vision analysis
      if (possibleActions.length > 0) {
        contextMessage += `You can: ${possibleActions.slice(0, 2).join(', ')}.`;
      } else {
        contextMessage += 'I can help you analyze the trends and patterns in this data.';
      }
      
      message = contextMessage;
      dataElements.push(chartType);
      confidence = visionData.confidence;
    }
    // Check for chart type directly (from DataAgent)
    else if (extractedData.some((d) => d.type === 'chart')) {
      const chartData = extractedData.find((d) => d.type === 'chart');
      if (chartData) {
        const chartMeta = (chartData.data as any);
        message = `I detected a chart visualization. I can help you understand the trends and insights.`;
        dataElements.push('Chart');
        confidence = chartData.confidence;
      }
    }
    // Check if data came from DOM (table)
    else if (extractedData.some((d) => d.type === 'table')) {
      const tableData = extractedData.find((d) => d.type === 'table');
      if (tableData && tableData.schema?.columns) {
        const columns = tableData.schema.columns.slice(0, 3).join(', ');
        const moreText = tableData.schema.columns.length > 3 ? ` (+${tableData.schema.columns.length - 3} more)` : '';
        message = `I detected a table with columns: ${columns}${moreText}. I can help you visualize and analyze this data.`;
        dataElements.push('Data Table');
        confidence = tableData.confidence;
      }
    }

    return { message, dataElements, confidence };
  }

  // ============================================================================
  // Phase 2: GUM Integration Methods
  // ============================================================================

  /**
   * Query GUM for user propositions via background script
   * Returns propositions from GeneralUserAgent
   */
  private async queryGUM(params?: QueryParams): Promise<Proposition[]> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: 'GUM_QUERY',
          payload: params || {},
          timestamp: Date.now(),
          source: 'orchestrator',
        },
        (response) => {
          if (response && response.propositions) {
            logger.info('OrchestratorAgent', 'GUM query successful', {
              propositionCount: response.propositions.length,
            });
            resolve(response.propositions);
          } else {
            logger.warn('OrchestratorAgent', 'GUM query failed or empty');
            resolve([]);
          }
        }
      );
    });
  }

  /**
   * NEW: Show hesitation popup with GUM propositions
   * Called when prolonged_hesitation is detected
   */
  private async showHesitationPopupWithGUM(extractionResult: DataExtractionResult): Promise<void> {
    logger.info('OrchestratorAgent', 'Showing hesitation popup with GUM propositions');

    try {
      // FIRST: Trigger immediate GUM inference to ensure fresh propositions
      logger.info('OrchestratorAgent', 'Triggering immediate GUM inference for struggle context');
      
      await new Promise<void>((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: 'GUM_TRIGGER_INFERENCE',
            payload: {},
            timestamp: Date.now(),
            source: 'orchestrator',
          },
          (response) => {
            if (response && response.success) {
              logger.info('OrchestratorAgent', 'Immediate inference complete', {
                propositionCount: response.count,
              });
            } else {
              logger.warn('OrchestratorAgent', 'Immediate inference failed or incomplete');
            }
            resolve();
          }
        );
      });

      // THEN: Query GUM for current user model with high confidence propositions
      const propositions = await this.queryGUM({
        minConfidence: 0.3,
        applyDecay: true,
      });

      if (propositions.length === 0) {
        logger.warn('OrchestratorAgent', '⚠️ No GUM propositions available, showing default message');
        
        // Fallback to standard guidance if no GUM data yet
        const context = this.inferContext(extractionResult);
        await hierarchicalGuidanceUI.showTaskPlanningUI(extractionResult, context, {
          onGoalSelected: (goal: AnalyticalGoal) => this.handleGoalSelection(goal),
          onDismiss: () => this.dismissGuidance(),
        });
        return;
      }

      // Show hesitation popup with GUM propositions
      await hierarchicalGuidanceUI.showHesitationPopup(propositions, {
        onContinueWithGoal: (goal: AnalyticalGoal) => {
          // User selected a goal from GUM-inferred options
          this.handleGoalSelection(goal);
        },
        onViewFullModel: async () => {
          // User wants to see full user model
          await this.showFullUserModel();
        },
        onDismiss: () => this.dismissGuidance(),
      });

      logger.info('OrchestratorAgent', 'Hesitation popup shown with GUM propositions');

    } catch (error) {
      logger.error('OrchestratorAgent', 'Failed to show hesitation popup', error);
      this.dismissGuidance();
    }
  }

  /**
   * Enhanced context inference using GUM propositions
   * Combines tactical struggle data with strategic user model
   */
  private async inferContextWithGUM(extractionResult: DataExtractionResult): Promise<InferredContext> {
    // Start with base context from data extraction
    const baseContext = this.inferContext(extractionResult);

    try {
      // Query GUM for relevant propositions
      const propositions = await this.queryGUM({
        minConfidence: 0.4,
        applyDecay: true,
      });

      if (propositions.length === 0) {
        logger.info('OrchestratorAgent', 'No GUM propositions yet, using base context');
        return baseContext;
      }

      // Extract goal propositions to enhance context
      const goalProps = propositions.filter(p => p.category === 'goal');
      const activityProps = propositions.filter(p => p.category === 'activity');
      
      // Enhance message with GUM insights
      let enhancedMessage = baseContext.message;
      
      if (goalProps.length > 0) {
        const topGoal = goalProps[0];
        enhancedMessage = `Based on your recent activity, I think you're trying to ${topGoal.text.toLowerCase()}. ${baseContext.message}`;
      } else if (activityProps.length > 0) {
        const topActivity = activityProps[0];
        enhancedMessage = `I noticed ${topActivity.text.toLowerCase()}. ${baseContext.message}`;
      }

      return {
        ...baseContext,
        message: enhancedMessage,
        confidence: Math.max(baseContext.confidence, propositions[0].confidence * propositions[0].decayScore),
      };

    } catch (error) {
      logger.error('OrchestratorAgent', 'Failed to enhance context with GUM', error);
      return baseContext;
    }
  }

  /**
   * Show full user model modal (transparency feature)
   */
  private async showFullUserModel(): Promise<void> {
    logger.info('OrchestratorAgent', 'Showing full user model');

    try {
      const propositions = await this.queryGUM();

      await hierarchicalGuidanceUI.showUserModelModal(propositions, {
        onEdit: async (id: string, updates: Partial<Proposition>) => {
          await this.editProposition(id, updates);
        },
        onDelete: async (id: string) => {
          await this.deleteProposition(id);
        },
        onDismiss: () => {
          // Return to previous UI state
          if (this.state.extractionResult) {
            this.startHierarchicalGuidance(this.state.extractionResult);
          }
        },
      });

    } catch (error) {
      logger.error('OrchestratorAgent', 'Failed to show user model', error);
    }
  }

  /**
   * Edit a GUM proposition (user control - Amershi G17)
   */
  private async editProposition(id: string, updates: Partial<Proposition>): Promise<void> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: 'GUM_EDIT_PROPOSITION',
          payload: { id, updates },
          timestamp: Date.now(),
          source: 'orchestrator',
        },
        (response) => {
          if (response && response.success) {
            logger.info('OrchestratorAgent', 'Proposition edited', { id });
          } else {
            logger.error('OrchestratorAgent', 'Failed to edit proposition', { id });
          }
          resolve();
        }
      );
    });
  }

  /**
   * Delete a GUM proposition (user control - Amershi G17)
   */
  private async deleteProposition(id: string): Promise<void> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: 'GUM_DELETE_PROPOSITION',
          payload: { id },
          timestamp: Date.now(),
          source: 'orchestrator',
        },
        (response) => {
          if (response && response.success) {
            logger.info('OrchestratorAgent', 'Proposition deleted', { id });
          } else {
            logger.error('OrchestratorAgent', 'Failed to delete proposition', { id });
          }
          resolve();
        }
      );
    });
  }

  /**
   * Get current state (for debugging/monitoring)
   */
  public getState(): OrchestratorState {
    return { ...this.state };
  }
}

// Singleton instance
export const orchestratorAgent = new OrchestratorAgent();
