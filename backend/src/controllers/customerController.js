const Customer = require('../models/Customer');

async function listCustomers(req, res, next) {
  try {
    const search = String(req.query?.search || '').trim();
    const status = String(req.query?.status || '').trim();
    const sort = String(req.query?.sort || 'newest');

    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } }
      ];
    }
    if (status && ['active', 'inactive', 'lead'].includes(status)) {
      query.status = status;
    }

    const sortMap = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      name_asc: { name: 1 },
      name_desc: { name: -1 }
    };
    const customers = await Customer.find(query).sort(sortMap[sort] || sortMap.newest);
    res.json(customers);
  } catch (err) {
    next(err);
  }
}

async function createCustomer(req, res, next) {
  try {
    const customer = await Customer.create(req.body);
    res.status(201).json(customer);
  } catch (err) {
    next(err);
  }
}

async function uploadCustomerDocument(req, res, next) {
  try {
    const id = req.params.id;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: 'File is required' });
    }

    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    customer.documents.unshift({
      fileName: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      path: file.path,
      uploadedByEmail: req.user?.email,
      uploadedAt: new Date()
    });

    await customer.save();
    return res.json(customer);
  } catch (err) {
    next(err);
  }
}

module.exports = { listCustomers, createCustomer, uploadCustomerDocument };

