import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"service"))
from review import parse_rubric,evaluate,model_extract,run

class ReviewTests(unittest.TestCase):
    def test_unknown_and_negated_phrase(self):
        rubric=parse_rubric("!React|3\nPython|2")
        out=evaluate("Built React tools. No Python experience.",rubric)
        self.assertEqual(out["score"],60)
        self.assertEqual(out["evidence"][1]["status"],"unknown")
    def test_model_quote_validation(self):
        rubric=parse_rubric("!React")
        class FakeResponse:
            def __enter__(self): return self
            def __exit__(self,*args): pass
            def read(self): return b'{}'
        with patch("review.urllib.request.urlopen",return_value=FakeResponse()),patch("review.json.load",return_value={"output":[{"content":[{"type":"output_text","text":json.dumps({"evidence":[{"criterion_id":"c0","quote":"React expert"}]})}]}]}):
            out=model_extract("Built an API in Go.",rubric,"demo-model","fake-key")
        self.assertEqual(out["evidence"][0]["status"],"unknown")
        self.assertTrue(out["needs_review"])
    def test_batch_persistence_and_run_audit(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d); folder=root/"resumes"; folder.mkdir()
            (folder/"a.txt").write_text("Built React apps. Shipped tests.")
            (folder/"b.txt").write_text("Worked in operations.")
            (root/"rubric.txt").write_text("!React\nTesting")
            result=run(folder,root/"rubric.txt",root/"review.db")
            self.assertEqual(result["evaluated"],2)
            self.assertEqual(result["results"][0]["name"],"a")
            self.assertTrue(result["results"][1]["needs_review"])

if __name__ == "__main__": unittest.main()
