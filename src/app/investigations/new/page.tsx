import { NewInvestigationForm } from "@/components/investigation/new-investigation-form";

export const metadata = { title: "New investigation" };

export default function NewInvestigationPage() {
  return (
    <div className="case-intake-page">
      <header className="case-intake-heading">
        <p className="case-eyebrow">New case <span>/</span> field intake</p>
        <h1>Give the archive<br /><em>a place to start.</em></h1>
        <p>Choose a surviving address or bring your own. This creates the case file; searches, browsing, and evidence collection happen after you enter it.</p>
      </header>
      <div className="case-intake-layout">
        <aside className="case-intake-context">
          <p className="case-intake-index">INTAKE SEQUENCE / 01—03</p>
          <h2>Every investigation starts with a trace.</h2>
          <div className="case-intake-step"><span>01</span><p><strong>Choose a starting address</strong><small>A live public page or your own URL.</small></p></div>
          <div className="case-intake-step"><span>02</span><p><strong>Set the question</strong><small>What should the archive try to recover?</small></p></div>
          <div className="case-intake-step"><span>03</span><p><strong>Enter the case room</strong><small>The search begins when you choose an action.</small></p></div>
          <div className="case-intake-signal" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
        </aside>
        <section className="case-intake-form">
        <NewInvestigationForm />
        </section>
    </div>
    </div>
  );
}
