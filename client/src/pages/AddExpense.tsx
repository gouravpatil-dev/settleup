import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAsync } from "../hooks/useAsync";
import { listMembers } from "../services/groups";
import { createExpense, type CreateExpenseParticipant } from "../services/expenses";
import { LoadingState } from "../components/LoadingState";
import { ErrorState } from "../components/ErrorState";
import { ApiError } from "../services/api";
import { toMinorUnits, formatCurrency } from "../utils/currency";
import type { SplitType } from "../types";

const today = new Date().toISOString().slice(0, 10);

export function AddExpense() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { data: membersData, loading, error } = useAsync(() => listMembers(groupId!), [groupId]);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(""); // rupees, as typed
  const [paidBy, setPaidBy] = useState("");
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState("");
  const [splitType, setSplitType] = useState<SplitType>("equal");
  const [participantIds, setParticipantIds] = useState<Set<string>>(new Set());
  const [splitValues, setSplitValues] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const members = membersData?.members ?? [];

  // Default to everyone selected, and the first member as payer, once members load.
  useEffect(() => {
    if (members.length > 0 && participantIds.size === 0) {
      setParticipantIds(new Set(members.map((m) => m.userId)));
    }
    if (members.length > 0 && !paidBy) {
      setPaidBy(members[0].userId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members.length]);

  const amountRupees = parseFloat(amount) || 0;
  const selectedParticipants = members.filter((m) => participantIds.has(m.userId));

  function toggleParticipant(userId: string) {
    setParticipantIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  function handleSplitTypeChange(next: SplitType) {
    setSplitType(next);
    setSplitValues({});
  }

  // Live validation for exact/percentage split configs, so the user
  // never has to guess why a split is invalid.
  const splitValidation = useMemo(() => {
    if (splitType === "exact") {
      const sum = selectedParticipants.reduce(
        (s, m) => s + (parseFloat(splitValues[m.userId]) || 0),
        0
      );
      const diff = Math.round((amountRupees - sum) * 100) / 100;
      return { sum, valid: Math.abs(diff) < 0.005, message: `Assigned ₹${sum.toFixed(2)} of ₹${amountRupees.toFixed(2)}` };
    }
    if (splitType === "percentage") {
      const sum = selectedParticipants.reduce(
        (s, m) => s + (parseFloat(splitValues[m.userId]) || 0),
        0
      );
      return { sum, valid: Math.abs(sum - 100) < 0.01, message: `${sum.toFixed(2)}% of 100%` };
    }
    if (splitType === "shares") {
      const allPositive = selectedParticipants.every((m) => (parseInt(splitValues[m.userId], 10) || 0) > 0);
      return { sum: 0, valid: selectedParticipants.length > 0 && allPositive, message: allPositive ? "Looks good" : "Every participant needs a positive share count" };
    }
    return { sum: 0, valid: true, message: "" };
  }, [splitType, splitValues, selectedParticipants, amountRupees]);

  const canSubmit =
    description.trim().length > 0 &&
    amountRupees > 0 &&
    paidBy.length > 0 &&
    selectedParticipants.length > 0 &&
    splitValidation.valid &&
    !submitting;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!groupId || !canSubmit) return;

    let participants: CreateExpenseParticipant[];
    if (splitType === "equal") {
      participants = selectedParticipants.map((m) => ({ userId: m.userId }));
    } else if (splitType === "exact") {
      participants = selectedParticipants.map((m) => ({
        userId: m.userId,
        amount: toMinorUnits(parseFloat(splitValues[m.userId]) || 0),
      }));
    } else if (splitType === "percentage") {
      participants = selectedParticipants.map((m) => ({
        userId: m.userId,
        percentage: parseFloat(splitValues[m.userId]) || 0,
      }));
    } else {
      participants = selectedParticipants.map((m) => ({
        userId: m.userId,
        shares: parseInt(splitValues[m.userId], 10) || 0,
      }));
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await createExpense(groupId, {
        description: description.trim(),
        amount: toMinorUnits(amountRupees),
        paidBy,
        date,
        category: category.trim() || undefined,
        splitType,
        participants,
      });
      navigate(`/groups/${groupId}/expenses/${res.expense.id}`);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Could not create the expense");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingState label="Loading group members…" />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <p>
        <Link to={`/groups/${groupId}`}>← Back to group</Link>
      </p>
      <h1>Add expense</h1>

      <form className="expense-form" onSubmit={handleSubmit}>
        <label>
          Description
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
            required
          />
        </label>

        <label>
          Amount (₹)
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </label>

        <label>
          Paid by
          <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)} required>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>

        <label>
          Category (optional)
          <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={50} />
        </label>

        <fieldset>
          <legend>Participants</legend>
          {members.map((m) => (
            <label key={m.userId} className="checkbox-row">
              <input
                type="checkbox"
                checked={participantIds.has(m.userId)}
                onChange={() => toggleParticipant(m.userId)}
              />
              {m.name}
            </label>
          ))}
        </fieldset>

        <fieldset>
          <legend>Split type</legend>
          {(["equal", "exact", "percentage", "shares"] as SplitType[]).map((type) => (
            <label key={type} className="radio-row">
              <input
                type="radio"
                name="splitType"
                checked={splitType === type}
                onChange={() => handleSplitTypeChange(type)}
              />
              {type[0].toUpperCase() + type.slice(1)}
            </label>
          ))}
        </fieldset>

        {splitType !== "equal" && selectedParticipants.length > 0 && (
          <fieldset>
            <legend>
              {splitType === "exact" && "Exact amount per person (₹)"}
              {splitType === "percentage" && "Percentage per person"}
              {splitType === "shares" && "Shares per person"}
            </legend>
            {selectedParticipants.map((m) => (
              <label key={m.userId} className="split-input-row">
                {m.name}
                <input
                  type="number"
                  inputMode="decimal"
                  step={splitType === "shares" ? "1" : "0.01"}
                  min="0"
                  value={splitValues[m.userId] ?? ""}
                  onChange={(e) =>
                    setSplitValues((prev) => ({ ...prev, [m.userId]: e.target.value }))
                  }
                />
              </label>
            ))}
            <p className={splitValidation.valid ? "validation-ok" : "validation-error"}>
              {splitValidation.message}
            </p>
          </fieldset>
        )}

        <section className="expense-review">
          <h2>Review</h2>
          <p>
            <strong>{description || "(no description)"}</strong> — {formatCurrency(toMinorUnits(amountRupees))}
          </p>
          <p>
            Paid by {members.find((m) => m.userId === paidBy)?.name ?? "—"}, split {splitType} across{" "}
            {selectedParticipants.length} {selectedParticipants.length === 1 ? "person" : "people"}
          </p>
        </section>

        {submitError && <ErrorState message={submitError} />}

        <button type="submit" disabled={!canSubmit}>
          {submitting ? "Creating…" : "Add expense"}
        </button>
      </form>
    </div>
  );
}
