const devStore = {
  leads: [],
  deals: [],
  customers: []
};

function createDevId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

module.exports = {
  devStore,
  createDevId
};
