import bcrypt from "bcryptjs";
import { User, Pharmacy, Medicine, Stock } from "./models.js";

/**
 * Seed default administrator, pharmacist, demo pharmacy, and initial catalogue
 * into MongoDB if they do not exist yet.
 */
export async function seedDefaults() {
  try {
    const adminId = process.env.ADMIN_ID || "115";
    const pharmacistId = process.env.PHARMACIST_ID || "116";
    const adminPass = process.env.ADMIN_PASSWORD || "51000";
    const pharmacistPass = process.env.PHARMACIST_PASSWORD || "51000";

    // 1. Ensure Administrator exists
    let admin = await User.findOne({ userId: adminId });
    if (!admin) {
      admin = await User.create({
        userId: adminId,
        name: "MedMap Administrator",
        email: "admin@medmap.local",
        role: "admin",
        passwordHash: await bcrypt.hash(adminPass, 10)
      });
      console.log(`[MedMap Seed] Administrator account (${adminId}) created.`);
    }

    // 2. Ensure Pharmacist exists
    let pharmacist = await User.findOne({ userId: pharmacistId });
    if (!pharmacist) {
      pharmacist = await User.create({
        userId: pharmacistId,
        name: "Demo Pharmacist",
        email: "pharmacist@medmap.local",
        role: "pharmacist",
        passwordHash: await bcrypt.hash(pharmacistPass, 10)
      });
      console.log(`[MedMap Seed] Pharmacist account (${pharmacistId}) created.`);
    }

    // 3. Ensure Demo Pharmacy exists
    let pharmacy = await Pharmacy.findOne({ name: "MedMap Community Pharmacy" });
    if (!pharmacy) {
      pharmacy = await Pharmacy.create({
        name: "MedMap Community Pharmacy",
        address: "Main Road, Near City Centre",
        city: "Pune",
        phone: "9000000000",
        pharmacistId: pharmacist._id,
        active: true
      });
      console.log("[MedMap Seed] Community Pharmacy created.");
    }

    if (!pharmacist.pharmacyId) {
      pharmacist.pharmacyId = pharmacy._id;
      await pharmacist.save();
    }
    if (!pharmacy.pharmacistId) {
      pharmacy.pharmacistId = pharmacist._id;
      await pharmacy.save();
    }

    // 4. Ensure Sample Medicines & Stocks exist
    const samples = [
      {
        name: "Paracetamol 500 mg",
        brand: "Generic",
        category: "Pain relief",
        description: "For pain and fever. Follow the label or a clinician's advice.",
        prescriptionRequired: false,
        price: 30,
        qty: 25
      },
      {
        name: "Cetirizine 10 mg",
        brand: "Generic",
        category: "Allergy",
        description: "For allergy symptoms. May cause drowsiness.",
        prescriptionRequired: false,
        price: 35,
        qty: 20
      },
      {
        name: "ORS Sachet",
        brand: "Generic",
        category: "Rehydration",
        description: "Oral rehydration salts.",
        prescriptionRequired: false,
        price: 25,
        qty: 30
      },
      {
        name: "Amoxicillin 500 mg",
        brand: "Generic",
        category: "Antibiotic",
        description: "Prescription required. Use only when prescribed.",
        prescriptionRequired: true,
        price: 80,
        qty: 15
      }
    ];

    for (const item of samples) {
      let med = await Medicine.findOne({ name: item.name });
      if (!med) {
        med = await Medicine.create({
          name: item.name,
          brand: item.brand,
          category: item.category,
          description: item.description,
          prescriptionRequired: item.prescriptionRequired
        });
      }
      const existingStock = await Stock.findOne({ pharmacyId: pharmacy._id, medicineId: med._id });
      if (!existingStock) {
        await Stock.create({
          pharmacyId: pharmacy._id,
          medicineId: med._id,
          quantity: item.qty,
          price: item.price,
          updatedBy: pharmacist._id
        });
      }
    }

    console.log("[MedMap Seed] Database defaults verification finished.");
  } catch (err) {
    console.warn("[MedMap Seed Warning]:", err.message);
  }
}
