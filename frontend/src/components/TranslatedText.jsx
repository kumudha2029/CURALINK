import { useEffect, useState } from "react";

function TranslatedText({ text, language }) {
  const [translated, setTranslated] = useState(text);

  useEffect(() => {
    const translate = async () => {
      if (language === "English") {
        setTranslated(text);
        return;
      }

      const res = await fetch(
        `https://api.mymemory.translated.net/get?q=${text}&langpair=en|${
          language === "Tamil" ? "ta" : "hi"
        }`
      );

      const data = await res.json();
      setTranslated(data.responseData.translatedText);
    };

    translate();
  }, [text, language]);

  return <p>{translated}</p>;
}

export default TranslatedText;