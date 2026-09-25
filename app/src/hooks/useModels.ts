import { useStore } from "@/store";
import { useCallback } from "react";

export function useModels() {
  const models = useStore((s) => s.models);
  const selectedModelId = useStore((s) => s.selectedModelId);
  const selectModel = useStore((s) => s.selectModel);
  const loadModel = useStore((s) => s.loadModel);
  const unloadModel = useStore((s) => s.unloadModel);
  const downloadModel = useStore((s) => s.downloadModel);
  const probeCapabilities = useStore((s) => s.probeCapabilities);

  const selectedModel = models.find((m) => m.id === selectedModelId) || null;
  const loadedModels = models.filter((m) => m.isLoaded);

  const handleToggleLoad = useCallback(
    async (modelId: string) => {
      const model = models.find((m) => m.id === modelId);
      if (!model) return;
      if (model.isLoaded) {
        await unloadModel(modelId);
      } else {
        await loadModel(modelId);
      }
    },
    [models, loadModel, unloadModel]
  );

  return {
    models,
    loadedModels,
    selectedModel,
    selectedModelId,
    selectModel,
    toggleLoad: handleToggleLoad,
    downloadModel,
    probeCapabilities,
  };
}
