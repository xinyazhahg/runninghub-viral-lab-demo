async function deliverGeneratedResult({
  uploadAsset,
  createResult,
  settleBilling,
  markSuccess,
  deleteAsset,
  deleteResult,
}) {
  let asset = null;
  let result = null;
  let stage = 'storage_upload';
  try {
    asset = await uploadAsset();
    stage = 'result_create';
    result = await createResult(asset);
    stage = 'billing_settle';
    await settleBilling(result);
    stage = 'task_complete';
    await markSuccess({ asset, result });
    return { asset, result };
  } catch (error) {
    error.deliveryStage = error.deliveryStage || stage;
    if (result) await deleteResult(result).catch(() => {});
    if (asset) await deleteAsset(asset).catch(() => {});
    throw error;
  }
}

module.exports = { deliverGeneratedResult };
