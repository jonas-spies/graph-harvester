\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{info1thesis}[2016/01/27 Chair I thesis template]

%%% Read class options
% type of thesis
\newif\ifthesis@bachelor\thesis@bachelorfalse
\newif\ifthesis@master\thesis@masterfalse
\newif\ifthesis@seminar\thesis@seminarfalse
\newif\ifthesis@practical\thesis@practicalfalse
\newif\ifthesis@zula\thesis@zulafalse
% used document class (scrartcl or scrreprt)
\newif\ifthesis@artcl\thesis@artclfalse
% to check if one of the options was given
\newif\ifthesis@typeset\thesis@typesetfalse
\newif\ifthesis@english\thesis@englishfalse

\DeclareOption{bachelor}{
    \thesis@bachelortrue
    \thesis@artclfalse
    \thesis@typesettrue
}
\DeclareOption{master}{
    \thesis@mastertrue
    \thesis@artclfalse
    \thesis@typesettrue
}
\DeclareOption{seminar}{
    \thesis@seminartrue
    \thesis@artcltrue
    \thesis@typesettrue
}
\DeclareOption{practical}{
    \thesis@practicaltrue
    \thesis@artcltrue
    \thesis@typesettrue
}
\DeclareOption{zula}{
    \thesis@zulatrue
    \thesis@artclfalse
    \thesis@typesettrue
}

\DeclareOption{english}{\thesis@englishtrue} % change language to english
\DeclareOption*{% pass unknown options to base class
    \PassOptionsToClass{\CurrentOption}{scrartcl}%
    \PassOptionsToClass{\CurrentOption}{scrreprt}%
}
\ProcessOptions\relax % Read the class options

% Print error when no type (bachelor, master, ... was chosen)
\ifthesis@typeset\else
    \ClassError{info1thesis}{Did not select type of document. You have to
    use one of the following class options: bachelor, master, seminar,
    practical}{You have to use one of the following class options: bachelor,
    master, zula, seminar, practical.}
\fi

%%% Load the base class
\ifthesis@artcl
    \LoadClass[a4paper,abstract,titlepage]{scrartcl}
    \newcommand{\thesis@topbookmarklevel}{1}
\else
    \LoadClass[a4paper,abstract=off,bibliography=totoc]{scrreprt}
    \newcommand{\thesis@topbookmarklevel}{0}
\fi

%%% Language handling
% Set language specific package options
\ifthesis@english
    \usepackage[ngerman,main=english]{babel}
    \usepackage[font=small,format=hang,labelfont=bf,figurename=Fig.,tablename=Tab.]{caption}
    \usepackage[linesnumbered,algoruled,longend,vlined]{algorithm2e}
\else
    \usepackage[main=ngerman]{babel}
    \usepackage[font=small,format=hang,labelfont=bf,figurename=Abb.,tablename=Tab.]{caption}
    \usepackage[linesnumbered,algoruled,longend,vlined,german]{algorithm2e}
\fi


% Translations
\AtBeginDocument{%
    \providecaptionname{english}{\thesis@bachelorthesisname}{Bachelor Thesis}%
    \providecaptionname{english}{\thesis@masterthesisname}{Master Thesis}%
    \providecaptionname{english}{\thesis@seminarpapername}{Seminar Paper}%
    \providecaptionname{english}{\thesis@practicalpapername}{Practical Course Report}%
    \providecaptionname{english}{\thesis@zulapapername}{Zulassungsarbeit}%
    \providecaptionname{english}{\thesis@supervisorname@pl}{Advisors}%
    \providecaptionname{english}{\thesis@supervisorname@sing}{Advisor}%
    \providecaptionname{english}{\thesis@submissiondate}{Date of Submission}%
    \providecaptionname{english}{\thesis@revised}{Revised}%
    \providecaptionname{english}{\thesis@semester}{Semester}%
    \providecaptionname{english}{\thesis@titlepage}{Title Page}%
    \providecaptionname{english}{\thesis@abstract}{Abstract}%
    \providecaptionname{english}{\thesis@germanabstract}{Zusammenfassung}%
    \providecaptionname{english}{\thesis@englishabstract}{Abstract}%
    %
    \providecaptionname{ngerman}{\thesis@bachelorthesisname}{Bachelorarbeit}%
    \providecaptionname{ngerman}{\thesis@masterthesisname}{Masterarbeit}%
    \providecaptionname{ngerman}{\thesis@seminarpapername}{Seminararbeit}%
    \providecaptionname{ngerman}{\thesis@practicalpapername}{Praktikumsbericht}%
    \providecaptionname{ngerman}{\thesis@zulapapername}{Zulassungsarbeit}%
    \providecaptionname{ngerman}{\thesis@supervisorname@pl}{Betreuer}%
    \providecaptionname{ngerman}{\thesis@supervisorname@sing}{Betreuer}%
    \providecaptionname{ngerman}{\thesis@submissiondate}{Abgabedatum}%
    \providecaptionname{ngerman}{\thesis@revised}{\"Uberarbeitet}%
    \providecaptionname{ngerman}{\thesis@semester}{Semester}%
    \providecaptionname{ngerman}{\thesis@titlepage}{Titelseite}%
    \providecaptionname{ngerman}{\thesis@abstract}{Zusammenfassung}%
    \providecaptionname{ngerman}{\thesis@germanabstract}{Zusammenfassung}%
    \providecaptionname{ngerman}{\thesis@englishabstract}{Abstract}%
    %
    %Theorem translations
    \providecaptionname{ngerman}{\thesis@theorem}{Satz}%
    \providecaptionname{ngerman}{\thesis@lemma}{Lemma}%
    \providecaptionname{ngerman}{\thesis@corollary}{Korollar}%
    \providecaptionname{ngerman}{\thesis@figure}{Abbildung}%
    \providecaptionname{ngerman}{\thesis@table}{Tabelle}%
    \providecaptionname{ngerman}{\thesis@definition}{Definition}%
    \providecaptionname{ngerman}{\thesis@observation}{Beobachtung}%
    \providecaptionname{ngerman}{\thesis@claim}{Behauptung}%
    \providecaptionname{ngerman}{\thesis@proposition}{Proposition}%
    %
    \providecaptionname{english}{\thesis@theorem}{Theorem}%
    \providecaptionname{english}{\thesis@lemma}{Lemma}%
    \providecaptionname{english}{\thesis@corollary}{Corollary}%
    \providecaptionname{english}{\thesis@figure}{Figure}%
    \providecaptionname{english}{\thesis@table}{Table}%
    \providecaptionname{english}{\thesis@definition}{Definition}%
    \providecaptionname{english}{\thesis@observation}{Observation}%
    \providecaptionname{english}{\thesis@claim}{Claim}%
    \providecaptionname{english}{\thesis@proposition}{Proposition}%
    %
    %Algorithm2e translations
    \providecaptionname{ngerman}{\thesis@algorithminput}{Eingabe}%
    \providecaptionname{ngerman}{\thesis@algorithmoutput}{Ausgabe}%
    \providecaptionname{ngerman}{\thesis@algorithmand}{und}%
    \providecaptionname{ngerman}{\thesis@algorithmor}{oder}%
    \providecaptionname{ngerman}{\thesis@algorithmnot}{nicht}%
    %
    \providecaptionname{english}{\thesis@algorithminput}{Input}%
    \providecaptionname{english}{\thesis@algorithmoutput}{Output}%
    \providecaptionname{english}{\thesis@algorithmand}{and}%
    \providecaptionname{english}{\thesis@algorithmor}{or}%
    \providecaptionname{english}{\thesis@algorithmnot}{not}%
}

\DontPrintSemicolon
\SetArgSty{}
\SetKw{KwOr}{\thesis@algorithmor}
\SetKw{KwAnd}{\thesis@algorithmand}
\SetKw{KwNot}{\thesis@algorithmnot}
\SetKwInput{Input}{\thesis@algorithminput}
\SetKwInput{Output}{\thesis@algorithmoutput}
\setlength{\algomargin}{3ex}

\usepackage[fixlanguage]{mybabelbib}
\setbibliographyfont{title}{}
\setbibliographyfont{jtitle}{}
\setbibliographyfont{btitle}{\emph}
\setbibliographyfont{stitle}{\emph}
\setbibliographyfont{journal}{\emph}

\usepackage{amsmath,amsfonts,amssymb,amsthm}
\usepackage{graphicx,xcolor}
\usepackage[bookmarks,bookmarksnumbered,pdfusetitle,pdfencoding=auto]{hyperref}
\usepackage[labelfont=normalfont]{subcaption}
\usepackage{enumerate}
\usepackage{booktabs}

\usepackage[capitalise,noabbrev,nameinlink]{cleveref}
\ifthesis@english
    \crefname{claim}{Claim}{Claims}
    \Crefname{claim}{Claim}{Claims}
    \crefname{observation}{Observation}{Observations}
    \Crefname{observation}{Observation}{Observations}
\else
    \crefname{theorem}{Satz}{Sätze}
    \Crefname{theorem}{Satz}{Sätze}
    \crefname{observation}{Beobachtung}{Beobachtungen}
    \Crefname{observation}{Beobachtung}{Beobachtungen}
    \crefname{claim}{Behauptung}{Behauptungen}
    \Crefname{claim}{Behauptung}{Behauptungen}
    \crefname{proposition}{Proposition}{Propositionen}
    \Crefname{proposition}{Proposition}{Propositionen}
\fi

% needed for AfterEndPreamble
\RequirePackage{etoolbox}

% We use the following command to detect if there are multiple supervisors
% (to decide if we use singular or plural for the label)
% Written by Gustavo Mezzetti
% http://tex.stackexchange.com/questions/255921/check-occurrence-of-a-macro-inside-another-macro
\@ifdefinable\MacroDoesNotContainSavedName{}% Check for availability of names:
\@ifdefinable\@MacroDoesNotContainSavedName{}
\newcommand*\DefineMacroNameToBeSearched[1]{%
    \def\@MacroDoesNotContainSavedName##1#1##2\@@@{%
        \ifx\@empty##2\@empty % if ##2 is empty
    }%
    \def\MacroDoesNotContainSavedName##1{%
        TT\fi
        \expandafter\@MacroDoesNotContainSavedName##1#1\@@@
    }%
}



%%% Customized title page
% Set the subject variable depending on the selected document type
\ifthesis@bachelor    \subject{\thesis@bachelorthesisname}    \fi
\ifthesis@master    \subject{\thesis@masterthesisname}        \fi
\ifthesis@seminar    \subject{\thesis@seminarpapername}        \fi
\ifthesis@practical    \subject{\thesis@practicalpapername}    \fi
\ifthesis@zula        \subject{\thesis@zulapapername}            \fi

% introduce command for supervisors
\newcommand{\@supervisors}{}
\newcommand{\supervisors}[1]{%
    \gdef\@supervisors{%
        \begingroup%
        \renewcommand{\and}{\tabularnewline}%
        \begin{tabular}[t]{@{}l@{}}#1\end{tabular}%
        \endgroup%
    }%
}
\let\@germandate=\@empty
\newcommand{\germandate}[1]{\gdef\@germandate{#1}}
\newcommand{\@semester}{}
\newcommand{\semester}[1]{\gdef\@semester{#1}}
\newcommand{\@submissiondate}{}
\newcommand{\submissiondate}[1]{\gdef\@submissiondate{#1}}
\let\@revisiondate=\@empty
\newcommand{\revisiondate}[1]{\gdef\@revisiondate{#1}}

% TODO: adjust maketitle for seminar report
\if@titlepage
    \renewcommand{\maketitle}{%
    % Detect if we need singular or plural for supervisors
    \DefineMacroNameToBeSearched{\and}%
    \if\MacroDoesNotContainSavedName{\@supervisors}%
        \def\supervisorname{\thesis@supervisorname@sing}%
    \else%
        \def\supervisorname{\thesis@supervisorname@pl}%
    \fi%
    % this code is based on the definition of \maketitle in scrreprt.cls
    \begin{titlepage}
        \setlength{\parindent}{\z@}
        \setlength{\parskip}{\z@}
        \begin{center}
            \ifx\@subject\@empty \else
                {\subject@font \@subject \par}%
                \vskip \z@ \@plus2fill
            \fi
            {\titlefont\huge \@title\par}%
            \vskip \z@ \@plus1fill
            {\ifx\@subtitle\@empty\else\usekomafont{subtitle}\@subtitle\par\fi}%
            \vskip \z@ \@plus1fill
            {\Large \lineskip 0.75em
                \begin{tabular}[t]{c}
                    \@author
                \end{tabular}\par
            }%
            \vskip \z@ \@plus3fill
            \begin{tabular}[t]{ll}
                \ifthesis@seminar%
                    \thesis@semester: & \@semester \\%
                \fi
                \thesis@submissiondate: & \@date \\
                \ifx\@revisiondate\@empty\else \thesis@revised: & \@revisiondate \\\fi
                \supervisorname: & \@supervisors
            \end{tabular}
            \vskip \z@ \@plus3fill
            \includegraphics[width=7cm]{figures/siegel}
            \vskip \z@ \@plus2fill
            {
                Julius-Maximilians-Universit\"at W\"urzburg\\
                Lehrstuhl f\"ur Informatik I\\
                Algorithmen und Komplexit\"at
            }%
        \end{center}
    \end{titlepage}%
}
\fi
% Automatically insert title page at begin of document
\AfterEndPreamble{
    \pdfbookmark[\thesis@topbookmarklevel]{\thesis@titlepage}{title}
    \global\let\thesis@author\@author
    \date{\@submissiondate}
    \maketitle
}

\usepackage{tabularx}

%%% Theorem environments
\newtheorem{theorem}{\thesis@theorem}
\newtheorem{lemma}[theorem]{\thesis@lemma}
\newtheorem{observation}[theorem]{\thesis@observation}
\newtheorem{claim}[theorem]{\thesis@claim}
\newtheorem{proposition}[theorem]{\thesis@proposition}
\newtheorem{corollary}[theorem]{\thesis@corollary}
\newtheorem{definition}[theorem]{\thesis@definition}
\theoremstyle{definition}

%numbering of theorems etc within chapters in bachelor and master theses
\ifthesis@artcl
\else
    \numberwithin{theorem}{chapter}
\fi


%%% Abstract
\KOMAoption{titlepage}{false}

\ifthesis@artcl
\else
    \let\thesis@oldabstract\abstract
    \let\endthesis@oldabstract\endabstract
    \renewenvironment{abstract}{%
        \pdfbookmark[\thesis@topbookmarklevel]{\abstractname}{abstract}
        \addchap*{\abstractname}
    }{\par}
\fi
\ifthesis@english
    \ifthesis@artcl
        \newenvironment{germanabstract}{%
            \begin{otherlanguage}{ngerman}%
                \pdfbookmark[\thesis@topbookmarklevel]{\thesis@abstract}{germanabstract}
                \begin{abstract}%
        }{%
                \end{abstract}%
            \end{otherlanguage}
        }
    \else
        \newenvironment{germanabstract}{%
            \begin{otherlanguage}{ngerman}%
                % Prevent page break before chapter title
                \let\clearpage\relax
                \pdfbookmark[\thesis@topbookmarklevel]{\thesis@abstract}{germanabstract}
                \addchap*{\abstractname}
        }{%
            \end{otherlanguage}
        }
    \fi
    \newenvironment{englishabstract}{%
        \ClassError{info1thesis}{Environment 'englishabstract' should be used in
            German theses only. If you write your thesis in English, simply use
            the 'abstract' environment instead.
            Note that you also need 'germanabstract' for an additional
            abstract in German}{}}{}
\else
    \ifthesis@artcl
        \newenvironment{englishabstract}{%
            \begin{otherlanguage}{english}%
                \pdfbookmark[\thesis@topbookmarklevel]{\thesis@abstract}{englishabstract}
                \begin{abstract}%
        }{%
                \end{abstract}%
            \end{otherlanguage}
        }
    \else
        \newenvironment{englishabstract}{%
            \begin{otherlanguage}{english}%
                % Prevent page break before chapter title
                \let\clearpage\relax
                \renewcommand{\abstractname}{Abstract}
                \pdfbookmark[\thesis@topbookmarklevel]{\thesis@abstract}{englishabstract}
                \addchap*{\abstractname}
        }{%
            \end{otherlanguage}
        }
    \fi
    \newenvironment{germanabstract}{%
        \ClassError{info1thesis}{Environment 'germanabstract' should be used in
            English theses only. If you write your thesis in German, simply use
            the 'abstract' environment instead.
            You may use 'englishabstract' for an additional abstract in English}{}}{}
\fi


%%% Table of Contents
\newcommand{\thesistableofcontents}{
    \ifthesis@artcl
    \else
        \clearpage
        \pdfbookmark[\thesis@topbookmarklevel]{\contentsname}{toc}
        \tableofcontents
    \fi
}

%%% Erklaerung
%\ifthesis@artcl
%\else
%\AtEndDocument{
%    %%% Erklärung
%    \clearpage
%    \ifx\@germandate\@empty
%        \gdef\@germandate{\@date}
%    \fi
%    \begin{otherlanguage}{ngerman}
%        \pdfbookmark[\thesis@topbookmarklevel]{Erkl\"arung}{erklaerung}
%        \chapter*{Erkl\"arung}
%        
%        \noindent
%        Hiermit versichere ich die vorliegende Abschlussarbeit
%        selbstst\"andig verfasst zu haben, keine anderen als die angegebenen
%        Quellen und Hilfsmittel benutzt zu haben, und die Arbeit bisher oder
%        gleichzeitig keiner anderen Pr\"ufungsbeh\"orde unter Erlangung
%        eines akademischen Grades vorgelegt zu haben.
%        \vspace{1cm}
%        
%        \noindent
%        W\"urzburg, den \@germandate \\[1.5cm]
%        $\cdots\cdots\cdots\cdots\cdots\cdots\cdots\cdots\cdots$ \\
%        \begingroup\renewcommand{\and}{\qquad}\thesis@author\endgroup
%    \end{otherlanguage}
%}
%\fi
