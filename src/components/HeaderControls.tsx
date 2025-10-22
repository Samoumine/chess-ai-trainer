/**
 * HeaderControls
 * ---------------
 * A minimal header bar with three controls:
 *  - Engine Type: Stockfish | MyEngine (future)
 *  - Difficulty: beginner | intermediate | hard
 *  - Engine Side: Off | Plays White | Plays Black
 *
 * It subscribes to engineUI store and applies changes to engineRegistry.
 * The status pill shows the current engine and whether it is ON/OFF and for which side.
 */

import React from "react";
import { engineUI } from "../state/engine-ui-store";

export function HeaderControls() {
  const [, force] = React.useState(0);
  React.useEffect(() => {
    const unsub = engineUI.subscribe(() => force((x) => x + 1));
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  const engineKind = engineUI.engineKind;
  const difficulty = engineUI.difficulty;
  const side = engineUI.side;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "8px 12px",
      borderBottom: "1px solid #222",
      background: "#111"
    }}>
      {/* --- Engine kind selector ------------------------------------------------ */}
      <label style={{ color: "#ddd" }}>
        Engine:&nbsp;
        <select
          value={engineKind}
          onChange={(e) => engineUI.setEngineKind(e.target.value as any)}
        >
          <option value="stockfish">Stockfish</option>
          <option value="myengine">MyEngine (alpha)</option>
        </select>
      </label>

      {/* --- Difficulty selector ------------------------------------------------- */}
      <label style={{ color: "#ddd" }}>
        Difficulty:&nbsp;
        <select
          value={difficulty}
          onChange={(e) => engineUI.setDifficulty(e.target.value as any)}
        >
          <option value="beginner">beginner</option>
          <option value="intermediate">intermediate</option>
          <option value="hard">hard</option>
        </select>
      </label>

      {/* --- Side selector ------------------------------------------------------- */}
      <label style={{ color: "#ddd" }}>
        Engine plays:&nbsp;
        <select
          value={side}
          onChange={(e) => engineUI.setSide(e.target.value as any)}
        >
          <option value="off">Off</option>
          <option value="white">White</option>
          <option value="black">Black</option>
        </select>
      </label>

      {/* --- Status pill --------------------------------------------------------- */}
      <div style={{
        marginLeft: "auto",
        color: "#aaa",
        fontSize: 12,
        padding: "2px 8px",
        border: "1px solid #333",
        borderRadius: 999
      }}>
        {`Engine: ${engineKind} (${difficulty}) • ${side === "off" ? "OFF" : "ON (" + side + ")"}`}
      </div>
    </div>
  );
}
