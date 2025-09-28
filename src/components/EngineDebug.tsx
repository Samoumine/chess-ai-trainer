import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { MinimaxEngine } from "../services/MinimaxEngine";

export default function EngineDebug() {
  const [logs, setLogs] = React.useState<string[]>([]);
  const engineRef = React.useRef<MinimaxEngine | null>(null);

  const log = (s: string) => setLogs(prev => [...prev.slice(-80), s]); // keep last ~80 lines

  const start = async () => {
    if (engineRef.current) return;
    const eng = new MinimaxEngine();
    engineRef.current = eng;
    await eng.start();
    eng.onMessage(line => log(line));
  };

  const send = (cmd: string) => {
    engineRef.current?.send(cmd);
    log(`> ${cmd}`);
  };

  const stop = () => {
    engineRef.current?.stop();
    engineRef.current = null;
    log("⏹ stopped");
  };

  return (
    <View style={{ padding: 12, gap: 8 }}>
      <Text style={{ color: "#ccc", fontWeight: "700" }}>Engine Debug</Text>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Pressable onPress={start} style={btn}><Text style={btnt}>Start</Text></Pressable>
        <Pressable onPress={() => send("uci")} style={btn}><Text style={btnt}>uci</Text></Pressable>
        <Pressable onPress={() => send("isready")} style={btn}><Text style={btnt}>isready</Text></Pressable>
        <Pressable onPress={() => send("ucinewgame")} style={btn}><Text style={btnt}>ucinewgame</Text></Pressable>
        <Pressable onPress={stop} style={btn}><Text style={btnt}>Stop</Text></Pressable>
      </View>
      <ScrollView style={{ height: 180, borderWidth: 1, borderColor: "#333", padding: 8 }}>
        {logs.map((l, i) => (
          <Text key={i} style={{ color: l.startsWith(">") ? "#8ab4f8" : "#ddd", fontFamily: "monospace" }}>
            {l}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const btn = { backgroundColor: "#333", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 } as const;
const btnt = { color: "#fff", fontWeight: "600" } as const;
