import os
import unittest
from unittest.mock import patch

from services import product_finder
from services.shop_builder import _normalize_products, _stage_metadata


def product(name, image):
    return {
        "name": name,
        "price": "19,99 EUR",
        "image": image,
        "shop": "Test Shop",
    }


class ProductSelectionTests(unittest.TestCase):
    def test_round_robin_selection_preserves_query_variety(self):
        queries = ["tech", "mode", "wohnen"]
        batches = {
            "tech": [product("Tech 1", "https://img/tech-1"), product("Tech 2", "https://img/tech-2")],
            "mode": [product("Mode 1", "https://img/mode-1"), product("Mode 2", "https://img/mode-2")],
            "wohnen": [product("Wohnen 1", "https://img/home-1"), product("Wohnen 2", "https://img/home-2")],
        }

        selected = product_finder.select_products_round_robin(
            queries,
            batches,
            max_products=5,
        )

        self.assertEqual(
            [item["name"] for item in selected],
            ["Tech 1", "Mode 1", "Wohnen 1", "Tech 2", "Mode 2"],
        )
        self.assertEqual(
            [item["search_query"] for item in selected[:3]],
            queries,
        )

    @patch("services.product_finder.search_high_quality_image")
    def test_image_upgrade_keeps_shopping_thumbnail(self, image_search):
        image_search.return_value = "https://img/high-resolution"
        products = [product("Kopfhörer", "https://img/shopping-thumbnail")]

        upgraded = product_finder.upgrade_product_images(products)

        self.assertEqual(upgraded[0]["image"], "https://img/high-resolution")
        self.assertEqual(
            upgraded[0]["thumbnailImage"],
            "https://img/shopping-thumbnail",
        )

    def test_shop_normalization_keeps_thumbnail_fallback(self):
        normalized = _normalize_products([
            {
                **product("Rucksack", "https://img/high-resolution"),
                "thumbnailImage": "https://img/shopping-thumbnail",
            }
        ])

        self.assertEqual(
            normalized[0]["thumbnailImage"],
            "https://img/shopping-thumbnail",
        )

    @patch("services.product_finder.upgrade_product_images")
    @patch("services.product_finder.search_product_batches")
    def test_generic_shop_takes_two_products_per_category(
        self,
        search_batches,
        upgrade_images,
    ):
        queries = product_finder.GENERIC_PRODUCT_QUERIES
        search_batches.return_value = {
            query: [
                product(f"{query} A", f"https://img/{index}-a"),
                product(f"{query} B", f"https://img/{index}-b"),
                product(f"{query} C", f"https://img/{index}-c"),
            ]
            for index, query in enumerate(queries)
        }
        upgrade_images.side_effect = lambda products: products

        with patch.dict(os.environ, {"SERPER_API_KEY": "test-key"}):
            selected = product_finder.find_generic_products(max_products=16)

        self.assertEqual(len(selected), 16)
        self.assertEqual(
            [item["search_query"] for item in selected[:len(queries)]],
            queries,
        )
        for query in queries:
            self.assertEqual(
                sum(item["search_query"] == query for item in selected),
                2,
            )


class StageFlowTests(unittest.TestCase):
    def test_transparency_and_control_have_separate_stage_scripts(self):
        scripts = _stage_metadata(3)["stageScripts"]

        self.assertEqual(
            list(scripts),
            ["generic", "personalized", "transparent", "transparent_control"],
        )
        self.assertIn("ohne Kontrolloptionen", scripts["transparent"]["goal"])
        self.assertIn("getrennt von Transparenz", scripts["transparent_control"]["goal"])


if __name__ == "__main__":
    unittest.main()
