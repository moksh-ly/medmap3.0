import mongoose from "mongoose";
import { inMemDb } from "./inMemoryDb.js";

const userSchema = new mongoose.Schema({
  userId: { type: String, unique: true, sparse: true },
  name: { type: String, required: true },
  email: { type: String, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["admin", "pharmacist", "patient"], required: true },
  pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: "Pharmacy", default: null }
}, { timestamps: true });

const pharmacySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true },
  city: { type: String, required: true, trim: true },
  phone: { type: String, default: "" },
  pharmacistId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  active: { type: Boolean, default: true }
}, { timestamps: true });

const medicineSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, index: true },
  brand: { type: String, default: "" },
  category: { type: String, default: "General" },
  description: { type: String, default: "" },
  prescriptionRequired: { type: Boolean, default: false }
}, { timestamps: true });

const stockSchema = new mongoose.Schema({
  pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: "Pharmacy", required: true },
  medicineId: { type: mongoose.Schema.Types.ObjectId, ref: "Medicine", required: true },
  quantity: { type: Number, required: true, min: 0 },
  price: { type: Number, required: true, min: 0 },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });
stockSchema.index({ pharmacyId: 1, medicineId: 1 }, { unique: true });

const orderSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: "Pharmacy", required: true },
  pharmacistId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  items: [{ medicineId: { type: mongoose.Schema.Types.ObjectId, ref: "Medicine" }, name: String, quantity: Number, price: Number }],
  total: { type: Number, required: true },
  status: { type: String, enum: ["Placed", "Accepted", "Ready", "Completed", "Cancelled"], default: "Placed" },
  patientName: { type: String, required: true },
  patientPhone: { type: String, required: true },
  deliveryAddress: { type: String, required: true },
  paymentMethod: { type: String, enum: ["Cash on delivery", "UPI at pharmacy", "Card at pharmacy"], required: true }
}, { timestamps: true });

const MongoUser = mongoose.models.User || mongoose.model("User", userSchema);
const MongoPharmacy = mongoose.models.Pharmacy || mongoose.model("Pharmacy", pharmacySchema);
const MongoMedicine = mongoose.models.Medicine || mongoose.model("Medicine", medicineSchema);
const MongoStock = mongoose.models.Stock || mongoose.model("Stock", stockSchema);
const MongoOrder = mongoose.models.Order || mongoose.model("Order", orderSchema);

export const isMongoConnected = () => mongoose.connection.readyState === 1;

function createModelProxy(mongoModel, inMemCollection) {
  return new Proxy(mongoModel, {
    get(target, prop) {
      if (isMongoConnected()) {
        const val = target[prop];
        return typeof val === "function" ? val.bind(target) : val;
      }
      if (prop in inMemCollection) {
        const val = inMemCollection[prop];
        return typeof val === "function" ? val.bind(inMemCollection) : val;
      }
      const val = target[prop];
      return typeof val === "function" ? val.bind(target) : val;
    }
  });
}

export const User = createModelProxy(MongoUser, inMemDb.users);
export const Pharmacy = createModelProxy(MongoPharmacy, inMemDb.pharmacies);
export const Medicine = createModelProxy(MongoMedicine, inMemDb.medicines);
export const Stock = createModelProxy(MongoStock, inMemDb.stocks);
export const Order = createModelProxy(MongoOrder, inMemDb.orders);
