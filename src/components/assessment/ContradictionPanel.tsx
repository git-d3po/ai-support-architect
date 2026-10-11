import type { ValidationError } from "@/domain/types";

export function ContradictionPanel({ errors }: { errors: ValidationError[] }) {
  return (
    <section role="alert" className="panel border-restrict/40">
      <div className="panel-head bg-restrict-soft"><h2 className="text-sm font-semibold">Contradictory inputs — recommendation withheld</h2></div>
      <ul className="space-y-1 p-4 text-sm">
        {errors.map((e, i) => <li key={i}>• {e.message}</li>)}
      </ul>
      <p className="border-t px-4 py-2 text-[13px] text-muted-foreground">Inputs must agree with the workflow's authoritative attributes. Resolve them to see a recommendation.</p>
    </section>
  );
}
