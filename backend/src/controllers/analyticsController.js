const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const Customer = require('../models/Customer');
const Project = require('../models/Project');
const Task = require('../models/Task');

function monthKey(dateLike) {
  const d = new Date(dateLike);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function buildMonthRange(monthCount) {
  const out = [];
  const now = new Date();
  now.setDate(1);
  for (let i = monthCount - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    out.push(monthKey(d));
  }
  return out;
}

function addSeriesValue(seriesMap, key, value) {
  seriesMap[key] = Number(seriesMap[key] || 0) + Number(value || 0);
}

async function getAnalytics(req, res, next) {
  try {
    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      return res.json({
        kpis: {
          totalLeads: 0,
          wonLeads: 0,
          leadConversionRate: 0,
          totalCustomers: 0,
          openTasks: 0,
          completedTasks: 0
        },
        monthlySales: [],
        customerGrowth: [],
        leadStatusBreakdown: [],
        activity: []
      });
    }

    const [leads, customers, projects, tasks] = await Promise.all([
      Lead.find().select('status expectedValue createdAt'),
      Customer.find().select('createdAt'),
      Project.find().select('budget completion createdAt status'),
      Task.find().select('status submitted createdAt updatedAt')
    ]);

    const totalLeads = leads.length;
    const wonLeads = leads.filter((l) => l.status === 'won').length;
    const leadConversionRate = totalLeads > 0 ? Number(((wonLeads / totalLeads) * 100).toFixed(2)) : 0;

    const openTasks = tasks.filter((t) => t.status !== 'completed').length;
    const completedTasks = tasks.filter((t) => t.status === 'completed').length;

    const months = buildMonthRange(6);
    const salesMap = Object.fromEntries(months.map((k) => [k, 0]));
    const customerMap = Object.fromEntries(months.map((k) => [k, 0]));

    projects.forEach((project) => {
      const key = monthKey(project.createdAt);
      if (salesMap[key] !== undefined) {
        const weighted = (Number(project.budget || 0) * Number(project.completion || 0)) / 100;
        addSeriesValue(salesMap, key, weighted);
      }
    });

    customers.forEach((customer) => {
      const key = monthKey(customer.createdAt);
      if (customerMap[key] !== undefined) addSeriesValue(customerMap, key, 1);
    });

    let cumulative = 0;
    const customerGrowth = months.map((m) => {
      cumulative += Number(customerMap[m] || 0);
      return { month: m, customers: cumulative };
    });

    const monthlySales = months.map((m) => ({ month: m, value: Number((salesMap[m] || 0).toFixed(2)) }));

    const leadStatusCounts = ['new', 'qualified', 'negotiation', 'won', 'lost']
      .map((status) => ({ status, count: leads.filter((l) => l.status === status).length }));

    const activity = [
      ...leads.map((l) => ({ type: 'lead', action: `Lead ${l.status}`, at: l.createdAt })),
      ...tasks.map((t) => ({ type: 'task', action: t.submitted ? 'Task submitted' : `Task ${t.status}`, at: t.updatedAt || t.createdAt }))
    ]
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 12);

    return res.json({
      kpis: {
        totalLeads,
        wonLeads,
        leadConversionRate,
        totalCustomers: customers.length,
        openTasks,
        completedTasks
      },
      monthlySales,
      customerGrowth,
      leadStatusBreakdown: leadStatusCounts,
      activity
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAnalytics
};