import { Router } from "express";
import { checkJwt } from "../../middleware/auth.js";
import { requireScope } from "../../middleware/requireScope.js";
import { productController } from "./product.controller.js";

const router = Router();

router.use(checkJwt);

router.get("/",       requireScope("read:products"),   productController.list);
router.get("/:id",    requireScope("read:products"),   productController.get);
router.post("/",      requireScope("write:products"),  productController.create);
router.put("/:id",    requireScope("write:products"),  productController.update);
router.delete("/:id", requireScope("delete:products"), productController.remove);

export { router as productsRouter };
