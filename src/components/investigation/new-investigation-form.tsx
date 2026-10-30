"use client";

import { useActionState, useEffect, useState } from "react";
import { startInvestigation, type StartInvestigationState } from "@/app/investigations/new/actions";
import { buttonClass, fieldClass } from "@/components/ui/panel";
import { beginInvestigationAudio, closeInvestigationAudio } from "@/lib/audio/session";
import { investigationScenarios, type InvestigationScenario } from "@/lib/investigations/scenarios";
import { parsePreferences, settingsStorageKey } from "@/lib/settings/preferences";

export function NewInvestigationForm() {
  const [state, action, pending] = useActionState<StartInvestigationState, FormData>(
    startInvestigation,
    null,
  );
  const [title, setTitle] = useState("");
  const [starting, setStarting] = useState("");
  const [objective, setObjective] = useState("");
  const [scenarioId, setScenarioId] = useState<string | null>(null);

  function applyScenario(scenario: InvestigationScenario) {
    setScenarioId(scenario.id);
    setTitle(scenario.title);
    setStarting(scenario.startingUrl);
    setObjective(scenario.objective);
  }

  useEffect(() => {
    if (state?.error) {
      closeInvestigationAudio();
    }
  }, [state]);

  return (
    <form
      action={action}
      className="case-intake-fields space-y-5"
      noValidate
      onSubmit={(event) => {
        if (!event.currentTarget.checkValidity()) {
          return;
        }
        const preferences = parsePreferences(window.localStorage.getItem(settingsStorageKey) ?? "");
        beginInvestigationAudio({
          enabled: preferences.audioEnabled,
          ambient: preferences.ambient,
          effects: preferences.effects,
        });
      }}
    >
      <fieldset className="case-scenario-deck space-y-3">
        <legend className="text-sm text-foreground">Select a surviving trace</legend>
        <p className="text-sm leading-6 text-muted">
          These are real public addresses you can open. Choosing one fills the form. It does not create findings.
        </p>
        <div className="case-scenario-grid">
          {investigationScenarios.map((scenario, index) => (
            <button
              key={scenario.id}
              type="button"
              aria-pressed={scenarioId === scenario.id}
              className={`case-scenario-card ${scenarioId === scenario.id ? "is-selected" : ""}`}
              onClick={() => applyScenario(scenario)}
            >
              <span className="case-scenario-number">{String(index + 1).padStart(2, "0")}</span>
              <span className="case-scenario-title">{scenario.title}</span>
              <span className="case-scenario-url">{scenario.startingUrl}</span>
              <span className="case-scenario-note">{scenario.note}</span>
              <span className="case-scenario-mark" aria-hidden="true">{scenarioId === scenario.id ? "SELECTED" : "OPEN FILE"}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="case-intake-fields-grid">
      <div className="space-y-2">
        <label htmlFor="title" className="text-sm text-foreground">
          Investigation title
        </label>
        <input
          id="title"
          name="title"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className={fieldClass()}
          autoComplete="off"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="starting" className="text-sm text-foreground">
          Starting URL
        </label>
        <input
          id="starting"
          name="starting"
          required
          value={starting}
          onChange={(event) => setStarting(event.target.value)}
          className={fieldClass()}
          placeholder="https://"
          autoComplete="off"
          spellCheck={false}
        />
        <p className="text-sm leading-6 text-muted">An investigation opens from an http or https address.</p>
      </div>
      <div className="space-y-2">
        <label htmlFor="objective" className="text-sm text-foreground">
          Research objective
        </label>
        <textarea
          id="objective"
          name="objective"
          required
          rows={5}
          value={objective}
          onChange={(event) => setObjective(event.target.value)}
          className={fieldClass()}
        />
      </div>
      </div>
      {state?.error ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className={buttonClass()} disabled={pending}>
        {pending ? "Opening case file…" : "Open the case file"}
      </button>
    </form>
  );
}
