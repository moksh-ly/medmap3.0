import bcrypt from "bcryptjs";
import { User, Pharmacy, Medicine, Stock } from "./models.js";

export async function seedDefaults() {
  const adminId = process.env.ADMIN_ID || "115";
  const pharmacistId = process.env.PHARMACIST_ID || "116";
  const adminPass = process.env.ADMIN_PASSWORD || "51000";
  const pharmacistPass = process.env.PHARMACIST_PASSWORD || "51000";

  let admin = await User.findOne({ userId: adminId });
  if (!admin) admin = await User.create({
    userId: adminId, name: "MedMap Administrator", role: "admin",
    passwordHash: await bcrypt.hash(adminPass, 10)
  });

  let pharmacist = await User.findOne({ userId: pharmacistId });
  if (!pharmacist) pharmacist = await User.create({
    userId: pharmacistId, name: "Demo Pharmacist", role: "pharmacist",
    passwordHash: await bcrypt.hash(pharmacistPass, 10)
  });

  let pharmacy = await Pharmacy.findOne({ name: "MedMap Community Pharmacy" });
  if (!pharmacy) pharmacy = await Pharmacy.create({
    name: "MedMap Community Pharmacy", address: "Main Road, Near City Centre",
    city: "Pune", phone: "9000000000", pharmacistId: pharmacist._id
  });
  if (!pharmacist.pharmacyId) {
    pharmacist.pharmacyId = pharmacy._id;
    await pharmacist.save();
  }
  if (!pharmacy.pharmacistId) {
    pharmacy.pharmacistId = pharmacist._id;
    await pharmacy.save();
  }

  const samples = [
    { name: "Paracetamol 500 mg", brand: "Generic", category: "Pain relief", description: "For pain and fever. Follow the label or a clinician's advice.", prescriptionRequired: false },
    { name: "Cetirizine 10 mg", brand: "Generic", category: "Allergy", description: "For allergy symptoms. May cause drowsiness.", prescriptionRequired: false },
    { name: "ORS Sachet", brand: "Generic", category: "Rehydration", description: "Oral rehydration salts.", prescriptionRequired: false },
    { name: "Amoxicillin 500 mg", brand: "Generic", category: "Antibiotic", description: "Prescription required. Use only when prescribed.", prescriptionRequired: true }
  ];
  for (const item of samples) {
    let med = await Medicine.findOne({ name: item.name });
    if (!med) med = await Medicine.create(item);
    const exists = await Stock.findOne({ pharmacyId: pharmacy._id, medicineId: med._id });
    if (!exists) await Stock.create({ pharmacyId: pharmacy._id, medicineId: med._id, quantity: item.name.startsWith("Amoxicillin") ? 0 : 20, price: item.name.startsWith("ORS") ? 25 : item.name.startsWith("Amoxicillin") ? 80 : 30, updatedBy: pharmacist._id });
  }
}
