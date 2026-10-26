import { createFileRoute } from "@tanstack/react-router";
import { AlignGame } from "@/components/align-game";

export const Route = createFileRoute("/")({
  component: AlignGame,
});
