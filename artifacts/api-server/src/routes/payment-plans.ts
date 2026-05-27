import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, paymentPlansTable, paymentInstallmentsTable, leadsTable, propertiesTable, dealsTable } from "@workspace/db";
import { MANAGER_ROLES } from "../lib/roles";

const router: IRouter = Router();

type InstallmentBody = {
  label: string;
  dueDate?: string | null;
  amount: number;
  status?: string;
};

function fmtPlan(p: typeof paymentPlansTable.$inferSelect) {
  return {
    ...p,
    totalAmount: Number(p.totalAmount),
    downPayment: Number(p.downPayment),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function fmtInstallment(i: typeof paymentInstallmentsTable.$inferSelect) {
  return {
    ...i,
    amount: Number(i.amount),
    paidAt: i.paidAt ? i.paidAt.toISOString() : null,
    createdAt: i.createdAt.toISOString(),
  };
}

router.get("/payment-plans", async (req, res): Promise<void> => {
  const { dealId, leadId, propertyId } = req.query;
  let plans = await db.select().from(paymentPlansTable).orderBy(paymentPlansTable.createdAt);

  if (dealId) plans = plans.filter(p => p.dealId === Number(dealId));
  if (leadId) plans = plans.filter(p => p.leadId === Number(leadId));
  if (propertyId) plans = plans.filter(p => p.propertyId === Number(propertyId));

  const planIds = plans.map(p => p.id);
  const allInstallments = planIds.length > 0
    ? await db.select().from(paymentInstallmentsTable)
    : [];

  const installmentsByPlan = new Map<number, (typeof paymentInstallmentsTable.$inferSelect)[]>();
  for (const inst of allInstallments) {
    const arr = installmentsByPlan.get(inst.planId) ?? [];
    arr.push(inst);
    installmentsByPlan.set(inst.planId, arr);
  }

  res.json(plans.map(p => ({
    ...fmtPlan(p),
    installments: (installmentsByPlan.get(p.id) ?? []).map(fmtInstallment),
  })));
});

router.post("/payment-plans", async (req, res): Promise<void> => {
  const { clientName, totalAmount, downPayment, dealId, leadId, propertyId, notes, installments } = req.body;
  if (!clientName || totalAmount == null) {
    res.status(400).json({ error: "clientName and totalAmount are required" }); return;
  }

  const [plan] = await db.insert(paymentPlansTable).values({
    clientName,
    totalAmount: String(totalAmount),
    downPayment: String(downPayment ?? 0),
    dealId: dealId ?? null,
    leadId: leadId ?? null,
    propertyId: propertyId ?? null,
    notes: notes ?? null,
  }).returning();

  const insts: (typeof paymentInstallmentsTable.$inferSelect)[] = [];
  if (Array.isArray(installments) && installments.length > 0) {
    const rows = await db.insert(paymentInstallmentsTable).values(
      (installments as InstallmentBody[]).map(i => ({
        planId: plan.id,
        label: i.label,
        dueDate: i.dueDate ?? null,
        amount: String(i.amount),
        status: i.status ?? "pending",
      }))
    ).returning();
    insts.push(...rows);
  }

  res.status(201).json({ ...fmtPlan(plan), installments: insts.map(fmtInstallment) });
});

router.get("/payment-plans/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [plan] = await db.select().from(paymentPlansTable).where(eq(paymentPlansTable.id, id));
  if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }

  const installments = await db.select().from(paymentInstallmentsTable).where(eq(paymentInstallmentsTable.planId, id));
  res.json({ ...fmtPlan(plan), installments: installments.map(fmtInstallment) });
});

router.put("/payment-plans/:planId/installments/:instId", async (req, res): Promise<void> => {
  const instId = Number(req.params.instId);
  const { status } = req.body;
  const updates: Partial<typeof paymentInstallmentsTable.$inferInsert> = { status };
  if (status === "paid") updates.paidAt = new Date();
  else updates.paidAt = null;

  const [inst] = await db.update(paymentInstallmentsTable).set(updates).where(eq(paymentInstallmentsTable.id, instId)).returning();
  if (!inst) { res.status(404).json({ error: "Installment not found" }); return; }
  res.json(fmtInstallment(inst));
});

router.delete("/payment-plans/:id", async (req, res): Promise<void> => {
  const user = req.user!;
  if (!MANAGER_ROLES.includes(user.role)) {
    res.status(403).json({ error: "Only managers can delete payment plans" }); return;
  }
  const id = Number(req.params.id);
  await db.delete(paymentInstallmentsTable).where(eq(paymentInstallmentsTable.planId, id));
  await db.delete(paymentPlansTable).where(eq(paymentPlansTable.id, id));
  res.status(204).end();
});

export default router;
