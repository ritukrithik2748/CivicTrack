import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthenticatedRequest, requireOfficerOrAdmin } from '../middleware/auth.js';
import { validateQuery } from '../middleware/validate.js';
import { getHeatmapData, getHotspots, getDepartmentScorecards, getContractorScorecards, getBudgetSummary, getDelayHistory, checkEarlyWarnings, sendEarlyWarningNotifications } from '../engines/analytics.js';

const router = Router();

// GET /api/analytics/heatmap - Heatmap data for open complaints
router.get('/heatmap', async (req: Request, res: Response) => {
  try {
    const data = getHeatmapData();
    res.json({ data });
  } catch (error) {
    console.error('Get heatmap error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get heatmap data' } });
  }
});

// GET /api/analytics/hotspots - Top problem hotspots
router.get('/hotspots', validateQuery(z.object({ limit: z.coerce.number().min(1).max(50).default(10) })), async (req: Request, res: Response) => {
  try {
    const { limit } = req.query as any;
    const data = getHotspots(limit);
    res.json({ data });
  } catch (error) {
    console.error('Get hotspots error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get hotspots' } });
  }
});

// GET /api/analytics/scorecards - Department and contractor scorecards
router.get('/scorecards', authMiddleware, requireOfficerOrAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const departments = getDepartmentScorecards();
    const contractors = getContractorScorecards();
    res.json({ departments, contractors });
  } catch (error) {
    console.error('Get scorecards error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get scorecards' } });
  }
});

// GET /api/analytics/budget - Budget summary
router.get('/budget', async (req: Request, res: Response) => {
  try {
    const data = getBudgetSummary();
    res.json(data);
  } catch (error) {
    console.error('Get budget error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get budget summary' } });
  }
});

// GET /api/analytics/delays - Delay history
router.get('/delays', async (req: Request, res: Response) => {
  try {
    const data = getDelayHistory();
    res.json({ data });
  } catch (error) {
    console.error('Get delays error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get delay history' } });
  }
});

// GET /api/analytics/early-warnings - Check early warnings (admin/officer)
router.get('/early-warnings', authMiddleware, requireOfficerOrAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const warnings = checkEarlyWarnings();
    res.json({ warnings });
  } catch (error) {
    console.error('Get early warnings error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get early warnings' } });
  }
});

// POST /api/analytics/send-warnings - Send early warning notifications (admin)
router.post('/send-warnings', authMiddleware, requireOfficerOrAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sent = sendEarlyWarningNotifications();
    res.json({ sent });
  } catch (error) {
    console.error('Send warnings error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to send early warnings' } });
  }
});

export default router;