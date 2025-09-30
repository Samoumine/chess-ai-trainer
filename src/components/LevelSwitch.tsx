import React from "react";
import { Pressable, Text, View } from "react-native";

type Level = "beginner" | "intermediate" | "hard";
export type LevelSwitchProps = {
  value: Level;
  onChange: (lv: Level) => void;
};

const pill = (active: boolean) => ({
  paddingVertical: 6,
  paddingHorizontal: 10,
  borderRadius: 999,
  backgroundColor: active ? "#4a6" : "#333",
  borderWidth: 1,
  borderColor: active ? "#6c9" : "#444",
  marginRight: 8,
});

export default function LevelSwitch({ value, onChange }: LevelSwitchProps) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {(["beginner","intermediate","hard"] as Level[]).map(lv => (
        <Pressable key={lv} onPress={() => onChange(lv)} style={pill(value === lv)}>
          <Text style={{ color: "#fff", fontWeight: "600", textTransform: "capitalize" }}>
            {lv}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
