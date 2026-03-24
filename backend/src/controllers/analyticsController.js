const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const Customer = require('../models/Customer');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Deal = require('../models/Deal');
const Employee = require('../models/Employee');
const Notification = require('../models/Notification');

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

function getRangeDays(range) {
  const map = { '7d': 7, '30d': 30, '90d': 90, '180d': 180, '365d': 365 };
  return map[String(range || '30d')] || 30;
}

function getRangeStart(range) {
  const days = getRangeDays(range);
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (days - 1));
  return d;
}

function listFromDevStore() {
  const { devStore } = require('../store/devCrmStore');
  const { _devTasks } = require('./taskController');
  const { _devProjects } = require('./projectController');
  const { _devEmployees } = require('./employeeController');

  return {
    leads: Array.isArray(devStore?.leads) ? devStore.leads : [],
    customers: Array.isArray(devStore?.customers) ? devStore.customers : [],
    deals: Array.isArray(devStore?.deals) ? devStore.deals : [],
    tasks: Array.isArray(_devTasks) ? _devTasks : [],
    projects: Array.isArray(_devProjects) ? _devProjects : [],
    employees: Array.isArray(_devEmployees) ? _devEmployees : []
  };
}

function filterByTeam(items, team, employees) {
  if (!team) return items;
  const teamEmails = new Set(
    (employees || [])
      .filter((member) => String(member.teamName || '') === team)
      .map((member) => String(member.email || '').trim())
      .filter(Boolean)
  );

  if (teamEmails.size === 0) return [];

  return (items || []).filter((item) => {
    const ownerEmail = String(item.ownerEmail || '').trim();
    const assignedEmail = String(item.assignedEmail || '').trim();
    const assignedEmails = Array.isArray(item.assignedEmails)
      ? item.assignedEmails.map((email) => String(email || '').trim()).filter(Boolean)
      : [];

    if (ownerEmail && teamEmails.has(ownerEmail)) return true;
    if (assignedEmail && teamEmails.has(assignedEmail)) return true;
    return assignedEmails.some((email) => teamEmails.has(email));
  });
}

async function getAnalytics(req, res, next) {
  try {
    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      const { leads, customers, deals, tasks, projects } = listFromDevStore();
      const totalLeads = leads.length;
      const wonLeads = leads.filter((l) => String(l.status || '') === 'won').length;
      const leadConversionRate = totalLeads > 0 ? Number(((wonLeads / totalLeads) * 100).toFixed(2)) : 0;

      const openTasks = tasks.filter((t) => String(t.status || '') !== 'completed').length;
      const completedTasks = tasks.filter((t) => String(t.status || '') === 'completed').length;
      const activeDeals = deals.filter((d) => !['won', 'lost'].includes(String(d.stage || ''))).length;
      const wonDealsValue = deals
        .filter((d) => String(d.stage || '') === 'won')
        .reduce((sum, d) => sum + Number(d.value || 0), 0);
      const overdueTasks = tasks.filter((t) => String(t.status || '') !== 'completed' && t.deadline && new Date(t.deadline) < new Date()).length;

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

      const leadStatusBreakdown = ['new', 'qualified', 'negotiation', 'proposal', 'converted', 'won', 'lost']
        .map((status) => ({
          status,
          count: leads.filter((l) => String(l.status || '') === status).length
        }))
        .filter((item) => item.count > 0);

      const activity = [
        ...leads.map((l) => ({ type: 'lead', action: `Lead ${String(l.status || 'new')}`, at: l.updatedAt || l.createdAt })),
        ...tasks.map((t) => ({ type: 'task', action: t.submitted ? 'Task submitted' : `Task ${String(t.status || 'pending')}`, at: t.updatedAt || t.createdAt }))
      ]
        .filter((item) => item.at)
        .sort((a, b) => new Date(b.at) - new Date(a.at))
        .slice(0, 12);

      return res.json({
        kpis: {
          totalLeads,
          wonLeads,
          leadConversionRate,
          totalCustomers: customers.length,
          openTasks,
          completedTasks,
          activeDeals,
          wonDealsValue: Number(wonDealsValue.toFixed(2)),
          overdueTasks
        },
        monthlySales,
        customerGrowth,
        leadStatusBreakdown,
        activity
      });
    }

    const [leads, customers, projects, tasks, deals] = await Promise.all([
      Lead.find().select('status expectedValue createdAt'),
      Customer.find().select('createdAt'),
      Project.find().select('budget completion createdAt status'),
      Task.find().select('status submitted createdAt updatedAt deadline'),
      Deal.find().select('stage value createdAt updatedAt')
    ]);

    const totalLeads = leads.length;
    const wonLeads = leads.filter((l) => l.status === 'won').length;
    const leadConversionRate = totalLeads > 0 ? Number(((wonLeads / totalLeads) * 100).toFixed(2)) : 0;

    const openTasks = tasks.filter((t) => t.status !== 'completed').length;
    const completedTasks = tasks.filter((t) => t.status === 'completed').length;
    const activeDeals = deals.filter((d) => !['won', 'lost'].includes(String(d.stage || ''))).length;
    const wonDealsValue = deals
      .filter((d) => d.stage === 'won')
      .reduce((sum, d) => sum + Number(d.value || 0), 0);
    const overdueTasks = tasks.filter((t) => t.status !== 'completed' && t.deadline && new Date(t.deadline) < new Date()).length;

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
        completedTasks,
        activeDeals,
        wonDealsValue: Number(wonDealsValue.toFixed(2)),
        overdueTasks
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

async function getAdvancedAnalytics(req, res, next) {
  try {
    const range = String(req.query?.range || '30d');
    const team = String(req.query?.team || '').trim();
    const start = getRangeStart(range);

    if (process.env.DISABLE_AUTH === 'true' || mongoose.connection.readyState !== 1) {
      const { leads: allLeads, customers: allCustomers, deals: allDeals, tasks: allTasks, employees } = listFromDevStore();

      const byRange = (items, dateField = 'createdAt') => (items || []).filter((item) => item?.[dateField] && new Date(item[dateField]) >= start);
      const leads = byRange(allLeads);
      const customers = byRange(allCustomers);
      let deals = byRange(allDeals);
      let tasks = byRange(allTasks);

      if (team) {
        deals = filterByTeam(deals, team, employees);
        tasks = filterByTeam(tasks, team, employees);
      }

      const salesFunnel = [
        'new', 'qualified', 'proposal', 'negotiation', 'converted', 'won', 'lost'
      ].map((stage) => ({
        stage,
        count: deals.filter((d) => String(d.stage || '') === stage).length,
        value: Number(
          deals
            .filter((d) => String(d.stage || '') === stage)
            .reduce((sum, d) => sum + Number(d.value || 0), 0)
            .toFixed(2)
        )
      }));

      const completedTasks = tasks.filter((t) => String(t.status || '') === 'completed');
      const avgTaskCompletionHours = completedTasks.length
        ? Number((completedTasks.reduce((sum, t) => {
            const end = t.completedAt ? new Date(t.completedAt) : new Date(t.updatedAt || t.createdAt);
            const startAt = new Date(t.createdAt);
            return sum + ((end - startAt) / (1000 * 60 * 60));
          }, 0) / completedTasks.length).toFixed(2))
        : 0;

      const memberEmails = new Set((employees || []).map((e) => e.email).filter(Boolean));
      const teamPerformance = Array.from(memberEmails).map((email) => {
        const ownedTasks = tasks.filter((t) => t.assignedEmail === email || (Array.isArray(t.assignedEmails) && t.assignedEmails.includes(email)));
        const done = ownedTasks.filter((t) => String(t.status || '') === 'completed').length;
        const userDeals = deals.filter((d) => d.ownerEmail === email);
        const wonValue = userDeals.filter((d) => String(d.stage || '') === 'won').reduce((sum, d) => sum + Number(d.value || 0), 0);
        const user = employees.find((e) => e.email === email);
        return {
          email,
          name: user?.name || email,
          teamName: user?.teamName || '-',
          completedTasks: done,
          totalTasks: ownedTasks.length,
          wonDealValue: Number(wonValue.toFixed(2))
        };
      }).filter((row) => !team || row.teamName === team).sort((a, b) => b.completedTasks - a.completedTasks);

      const monthKeys = buildMonthRange(Math.min(Math.ceil(getRangeDays(range) / 30), 12));
      const leadMap = Object.fromEntries(monthKeys.map((k) => [k, 0]));
      const dealMap = Object.fromEntries(monthKeys.map((k) => [k, 0]));

      leads.forEach((item) => {
        const key = monthKey(item.createdAt);
        if (leadMap[key] !== undefined) leadMap[key] += 1;
      });
      deals.forEach((item) => {
        const key = monthKey(item.createdAt);
        if (dealMap[key] !== undefined) dealMap[key] += Number(item.value || 0);
      });

      const timeline = monthKeys.map((k) => ({
        month: k,
        leads: Number(leadMap[k] || 0),
        dealValue: Number((dealMap[k] || 0).toFixed(2))
      }));

      return res.json({
        filters: { range, team },
        summary: {
          leadsCreated: leads.length,
          customersCreated: customers.length,
          dealsCreated: deals.length,
          wonDealValue: Number(deals.filter((d) => String(d.stage || '') === 'won').reduce((sum, d) => sum + Number(d.value || 0), 0).toFixed(2)),
          tasksCompleted: completedTasks.length,
          avgTaskCompletionHours,
          notificationsSent: 0
        },
        salesFunnel,
        teamPerformance,
        timeline
      });
    }

    const taskQuery = { createdAt: { $gte: start } };
    if (team) {
      const teamMembers = await Employee.find({ teamName: team }).select('email');
      const emails = teamMembers.map((m) => m.email).filter(Boolean);
      taskQuery.$or = [
        { assignedEmail: { $in: emails } },
        { assignedEmails: { $in: emails } }
      ];
    }

    const [leads, customers, deals, tasks, notifications, employees] = await Promise.all([
      Lead.find({ createdAt: { $gte: start } }).select('status expectedValue createdAt assignedTo'),
      Customer.find({ createdAt: { $gte: start } }).select('createdAt'),
      Deal.find({ createdAt: { $gte: start } }).select('stage value createdAt ownerEmail'),
      Task.find(taskQuery).select('status createdAt completedAt assignedEmail assignedEmails'),
      Notification.find({ createdAt: { $gte: start } }).select('createdAt type userEmail'),
      Employee.find({ status: 'active' }).select('email name teamName role')
    ]);

    const salesFunnel = [
      'new', 'qualified', 'proposal', 'negotiation', 'converted', 'won', 'lost'
    ].map((stage) => ({
      stage,
      count: deals.filter((d) => String(d.stage) === stage).length,
      value: Number(
        deals
          .filter((d) => String(d.stage) === stage)
          .reduce((sum, d) => sum + Number(d.value || 0), 0)
          .toFixed(2)
      )
    }));

    const memberEmails = new Set(employees.map((e) => e.email).filter(Boolean));
    const completedTasks = tasks.filter((t) => t.status === 'completed');
    const avgTaskCompletionHours = completedTasks.length
      ? Number((completedTasks.reduce((sum, t) => {
          const end = t.completedAt ? new Date(t.completedAt) : new Date(t.createdAt);
          const startAt = new Date(t.createdAt);
          return sum + ((end - startAt) / (1000 * 60 * 60));
        }, 0) / completedTasks.length).toFixed(2))
      : 0;

    const teamPerformance = Array.from(memberEmails).map((email) => {
      const ownedTasks = tasks.filter((t) => t.assignedEmail === email || (Array.isArray(t.assignedEmails) && t.assignedEmails.includes(email)));
      const done = ownedTasks.filter((t) => t.status === 'completed').length;
      const userDeals = deals.filter((d) => d.ownerEmail === email);
      const wonValue = userDeals.filter((d) => d.stage === 'won').reduce((sum, d) => sum + Number(d.value || 0), 0);
      const user = employees.find((e) => e.email === email);
      return {
        email,
        name: user?.name || email,
        teamName: user?.teamName || '-',
        completedTasks: done,
        totalTasks: ownedTasks.length,
        wonDealValue: Number(wonValue.toFixed(2))
      };
    }).sort((a, b) => b.completedTasks - a.completedTasks);

    const monthKeys = buildMonthRange(Math.min(Math.ceil(getRangeDays(range) / 30), 12));
    const leadMap = Object.fromEntries(monthKeys.map((k) => [k, 0]));
    const dealMap = Object.fromEntries(monthKeys.map((k) => [k, 0]));

    leads.forEach((item) => {
      const key = monthKey(item.createdAt);
      if (leadMap[key] !== undefined) leadMap[key] += 1;
    });
    deals.forEach((item) => {
      const key = monthKey(item.createdAt);
      if (dealMap[key] !== undefined) dealMap[key] += Number(item.value || 0);
    });

    const timeline = monthKeys.map((k) => ({
      month: k,
      leads: Number(leadMap[k] || 0),
      dealValue: Number((dealMap[k] || 0).toFixed(2))
    }));

    return res.json({
      filters: { range, team },
      summary: {
        leadsCreated: leads.length,
        customersCreated: customers.length,
        dealsCreated: deals.length,
        wonDealValue: Number(deals.filter((d) => d.stage === 'won').reduce((sum, d) => sum + Number(d.value || 0), 0).toFixed(2)),
        tasksCompleted: completedTasks.length,
        avgTaskCompletionHours,
        notificationsSent: notifications.length
      },
      salesFunnel,
      teamPerformance,
      timeline
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAnalytics,
  getAdvancedAnalytics
};