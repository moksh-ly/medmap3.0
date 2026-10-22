import crypto from "crypto";

function randomObjectId() {
  return crypto.randomBytes(12).toString("hex");
}

function matchFilter(doc, filter) {
  if (!filter || Object.keys(filter).length === 0) return true;
  for (const [key, val] of Object.entries(filter)) {
    if (key === "$or" && Array.isArray(val)) {
      if (!val.some(sub => matchFilter(doc, sub))) return false;
      continue;
    }
    const docVal = doc[key];
    if (val instanceof RegExp) {
      if (!val.test(String(docVal ?? ""))) return false;
    } else if (val && typeof val === "object" && "$gte" in val) {
      if (Number(docVal) < Number(val.$gte)) return false;
    } else if (val && typeof val === "object" && "_id" in val) {
      if (String(docVal) !== String(val._id)) return false;
    } else {
      if (docVal === undefined && val !== undefined) return false;
      if (String(docVal) !== String(val)) return false;
    }
  }
  return true;
}

async function populateDocField(doc, fieldName, selectSpec, collections) {
  if (!doc) return doc;
  if (fieldName === "pharmacistId") {
    const user = collections.users.docs.find(u => String(u._id) === String(doc.pharmacistId?._id || doc.pharmacistId));
    if (user) {
      doc.pharmacistId = selectFields(user, selectSpec);
    }
  } else if (fieldName === "patientId") {
    const user = collections.users.docs.find(u => String(u._id) === String(doc.patientId?._id || doc.patientId));
    if (user) {
      doc.patientId = selectFields(user, selectSpec);
    }
  } else if (fieldName === "pharmacyId") {
    const pharm = collections.pharmacies.docs.find(p => String(p._id) === String(doc.pharmacyId?._id || doc.pharmacyId));
    if (pharm) {
      doc.pharmacyId = selectFields(pharm, selectSpec);
    }
  } else if (fieldName === "medicineId") {
    const med = collections.medicines.docs.find(m => String(m._id) === String(doc.medicineId?._id || doc.medicineId));
    if (med) {
      doc.medicineId = selectFields(med, selectSpec);
    }
  }
  return doc;
}

function selectFields(doc, selectSpec) {
  if (!selectSpec) return { ...doc };
  const res = { _id: doc._id };
  const tokens = selectSpec.split(/\s+/).filter(Boolean);
  const isExclude = tokens.some(t => t.startsWith("-"));
  if (isExclude) {
    const excluded = new Set(tokens.filter(t => t.startsWith("-")).map(t => t.slice(1)));
    for (const [k, v] of Object.entries(doc)) {
      if (!excluded.has(k)) res[k] = v;
    }
  } else {
    for (const token of tokens) {
      if (token in doc) res[token] = doc[token];
    }
  }
  return res;
}

export class InMemDoc {
  constructor(data, collection, collections) {
    Object.assign(this, data);
    if (!this._id) this._id = randomObjectId();
    const now = new Date();
    if (!this.createdAt) this.createdAt = now;
    if (!this.updatedAt) this.updatedAt = now;
    Object.defineProperty(this, "_collection", { value: collection, enumerable: false, writable: true });
    Object.defineProperty(this, "_collections", { value: collections, enumerable: false, writable: true });
  }

  async save() {
    this.updatedAt = new Date();
    const idx = this._collection.findIndex(d => String(d._id) === String(this._id));
    if (idx >= 0) {
      this._collection[idx] = this;
    } else {
      this._collection.push(this);
    }
    return this;
  }

  async deleteOne() {
    const idx = this._collection.findIndex(d => String(d._id) === String(this._id));
    if (idx >= 0) this._collection.splice(idx, 1);
    return { acknowledged: true, deletedCount: 1 };
  }

  async populate(fields, select) {
    const list = Array.isArray(fields) ? fields : [{ field: fields, select }];
    for (const item of list) {
      const fieldName = typeof item === "string" ? item : item.field;
      const sel = typeof item === "object" ? item.select : select;
      await populateDocField(this, fieldName, sel, this._collections);
    }
    return this;
  }
}

function cloneDoc(d, collection, collections) {
  const plain = { ...d };
  if (Array.isArray(plain.items)) {
    plain.items = plain.items.map(item => ({ ...item }));
  }
  return new InMemDoc(plain, collection, collections);
}

class MemQuery {
  constructor(docsPromise, collections) {
    this._promise = docsPromise;
    this._collections = collections;
    this._populates = [];
    this._sort = null;
    this._select = null;
  }

  populate(field, select) {
    if (Array.isArray(field)) {
      field.forEach(f => this._populates.push({ field: f }));
    } else {
      this._populates.push({ field, select });
    }
    return this;
  }

  sort(sortSpec) {
    this._sort = sortSpec;
    return this;
  }

  select(selectSpec) {
    this._select = selectSpec;
    return this;
  }

  async exec() {
    const result = await this._promise;
    if (Array.isArray(result)) {
      let list = [...result];
      if (this._sort) {
        const [field, dir] = Object.entries(this._sort)[0];
        list.sort((a, b) => {
          const valA = a[field] ?? "";
          const valB = b[field] ?? "";
          if (valA < valB) return dir > 0 ? -1 : 1;
          if (valA > valB) return dir > 0 ? 1 : -1;
          return 0;
        });
      }
      for (const doc of list) {
        for (const pop of this._populates) {
          await populateDocField(doc, pop.field, pop.select, this._collections);
        }
        if (this._select) {
          const filtered = selectFields(doc, this._select);
          Object.keys(doc).forEach(k => {
            if (!(k in filtered)) delete doc[k];
          });
        }
      }
      return list;
    } else if (result) {
      for (const pop of this._populates) {
        await populateDocField(result, pop.field, pop.select, this._collections);
      }
      if (this._select) {
        return selectFields(result, this._select);
      }
      return result;
    }
    return null;
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  catch(reject) {
    return this.exec().catch(reject);
  }
}

export class InMemCollection {
  constructor(name, getCollections) {
    this.name = name;
    this.docs = [];
    this._getCollections = getCollections;
  }

  get collections() {
    return this._getCollections();
  }

  find(filter = {}) {
    return new MemQuery((async () => {
      return this.docs.filter(d => matchFilter(d, filter)).map(d => cloneDoc(d, this.docs, this.collections));
    })(), this.collections);
  }

  findOne(filter = {}) {
    return new MemQuery((async () => {
      const found = this.docs.find(d => matchFilter(d, filter));
      return found ? cloneDoc(found, this.docs, this.collections) : null;
    })(), this.collections);
  }

  findById(id) {
    return this.findOne({ _id: String(id) });
  }

  async create(data) {
    const doc = new InMemDoc(data, this.docs, this.collections);
    this.docs.push(doc);
    return cloneDoc(doc, this.docs, this.collections);
  }

  async findByIdAndUpdate(id, update, opts = {}) {
    const doc = this.docs.find(d => String(d._id) === String(id));
    if (!doc) return null;
    const patch = update.$set ? update.$set : update;
    Object.assign(doc, patch);
    doc.updatedAt = new Date();
    return cloneDoc(doc, this.docs, this.collections);
  }

  async findByIdAndDelete(id) {
    const idx = this.docs.findIndex(d => String(d._id) === String(id));
    if (idx < 0) return null;
    const [removed] = this.docs.splice(idx, 1);
    return cloneDoc(removed, this.docs, this.collections);
  }

  async findOneAndUpdate(filter, update, opts = {}) {
    let doc = this.docs.find(d => matchFilter(d, filter));
    if (!doc && opts.upsert) {
      const data = { ...filter };
      if (update.$set) Object.assign(data, update.$set);
      else Object.assign(data, update);
      doc = new InMemDoc(data, this.docs, this.collections);
      this.docs.push(doc);
      return cloneDoc(doc, this.docs, this.collections);
    }
    if (!doc) return null;
    const patch = update.$set ? update.$set : update;
    Object.assign(doc, patch);
    doc.updatedAt = new Date();
    return cloneDoc(doc, this.docs, this.collections);
  }

  async updateOne(filter, update) {
    const doc = this.docs.find(d => matchFilter(d, filter));
    if (!doc) return { matchedCount: 0, modifiedCount: 0 };
    if (update.$inc) {
      for (const [k, v] of Object.entries(update.$inc)) {
        doc[k] = (Number(doc[k]) || 0) + Number(v);
      }
    }
    if (update.$set) {
      Object.assign(doc, update.$set);
    }
    doc.updatedAt = new Date();
    return { matchedCount: 1, modifiedCount: 1 };
  }

  async deleteMany(filter = {}) {
    const initialLen = this.docs.length;
    this.docs = this.docs.filter(d => !matchFilter(d, filter));
    return { deletedCount: initialLen - this.docs.length };
  }
}

export const inMemDb = {
  users: null,
  pharmacies: null,
  medicines: null,
  stocks: null,
  orders: null,
};

const getCollections = () => inMemDb;

inMemDb.users = new InMemCollection("User", getCollections);
inMemDb.pharmacies = new InMemCollection("Pharmacy", getCollections);
inMemDb.medicines = new InMemCollection("Medicine", getCollections);
inMemDb.stocks = new InMemCollection("Stock", getCollections);
inMemDb.orders = new InMemCollection("Order", getCollections);
