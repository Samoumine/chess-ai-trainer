import React from "react";
import { Pressable, Text, View } from "react-native";

type PieceLetter = "q" | "r" | "b" | "n";
type Props = {
  visible: boolean;
  color: "w" | "b";
  onPick: (p: PieceLetter) => void;
  onCancel: () => void;
};

// Pure Unicode code points (more robust than pasted glyphs)
const U: Record<"w"|"b", Record<PieceLetter, string>> = {
  w: { q: "\u2655", r: "\u2656", b: "\u2657", n: "\u2658" }, // ♕ ♖ ♗ ♘
  b: { q: "\u265B", r: "\u265C", b: "\u265D", n: "\u265E" }, // ♛ ♜ ♝ ♞
};

export default function PromotionPicker({ visible, color, onPick, onCancel }: Props) {
  if (!visible) return null;

  const items: PieceLetter[] = ["q", "r", "b", "n"];

  return (
    <View
      // Full-screen overlay (works on web & native without Modal)
      style={{
        position: "absolute",
        left: 0, right: 0, top: 0, bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      {/* Click outside to cancel */}
      <Pressable
        onPress={onCancel}
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
      />

      {/* Picker */}
      <View
        style={{
          backgroundColor: "#1f1f1f",
          padding: 12,
          borderRadius: 16,
          flexDirection: "row",
          gap: 10,
          // Shadow (subtle)
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 8,
          elevation: 6,
        }}
      >
        {items.map(letter => (
          <Pressable
            key={letter}
            onPress={() => onPick(letter)}
            style={{
              width: 64, height: 64,
              borderRadius: 12,
              backgroundColor: "#2b2b2b",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 40, lineHeight: 44, color: "#fff" }}>
              {U[color][letter]}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Cancel text button */}
      <Pressable onPress={onCancel} style={{ marginTop: 12, padding: 8 }}>
        <Text style={{ color: "#ddd" }}>Cancel</Text>
      </Pressable>
    </View>
  );
}
